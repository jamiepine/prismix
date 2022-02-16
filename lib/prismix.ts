import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import { getDMMF, getConfig } from '@prisma/sdk';
import {
  deserializeEnums,
  deserializeDatasources,
  deserializeModels,
  deserializeGenerators
} from './deserializer';
import { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper/dist';
import glob from 'glob';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export interface MixerOptions {
  input: string[];
  output: string;
}

export interface PrismixOptions {
  mixers: MixerOptions[];
}
interface Field extends DMMF.Field {
  columnName?: string;
}
interface Model extends DMMF.Model {
  fields: Field[];
}

type UnPromisify<T> = T extends Promise<infer U> ? U : T;

type Schema = NonNullable<UnPromisify<ReturnType<typeof getSchema>>>;

async function getSchema(schemaPath: string) {
  try {
    const schema = await readFile(path.join(process.cwd(), schemaPath), {
      encoding: 'utf-8'
    });

    const dmmf = await getDMMF({ datamodel: schema });
    const fieldMappings = getModelFieldMappings(schema);
    const models: Model[] = dmmf.datamodel.models.map((model: Model) => ({
      ...model,
      fields: model.fields.map((field) =>
        // Inject columnName from the parsed fieldMappings above
        {
          return { ...field, columnName: fieldMappings[model.name]?.[field.name] };
        }
      )
    }));
    const config = await getConfig({ datamodel: schema });

    return {
      models,
      enums: dmmf.datamodel.enums,
      datasources: config.datasources,
      generators: config.generators
    };
  } catch (e) {
    console.error(
      `Prismix failed to parse schema located at "${schemaPath}". Did you attempt to reference to a model without creating an alias? Remember you must define a "blank" alias model with only the "@id" field in your extended schemas otherwise we can't parse your schema.`,
      e
    );
  }
}

function mixModels(inputModels: Model[]) {
  const models: Record<string, Model> = {};
  for (const newModel of inputModels) {
    const existingModel: Model | null = models[newModel.name];
    // if the model already exists in our found models, merge the fields
    if (existingModel) {
      const existingFieldNames = existingModel.fields.map((f) => f.name);
      for (const newField of newModel.fields) {
        // if this field exists in the existing model
        if (existingFieldNames.includes(newField.name)) {
          const existingFieldIndex: number = existingFieldNames.indexOf(newField.name);

          // Assign columnName (@map) based on existing field if found
          const existingField: Field = existingModel.fields[existingFieldIndex];
          if (!newField.columnName && existingField.columnName) {
            newField.columnName = existingField.columnName;
          }

          // replace the field at this index with the new one
          existingModel.fields[existingFieldIndex] = newField;
        } else {
          // if it doesn't already exist, append to field list
          existingModel.fields.push(newField);
        }
      }
      // Assign dbName (@@map) based on new model if found
      if (!existingModel.dbName && newModel.dbName) {
        existingModel.dbName = newModel.dbName;
      }
    } else {
      models[newModel.name] = newModel;
    }
  }
  return Object.values(models);
}

// Extract @map attributes, which aren't accessible from the prisma SDK
// Adapted from https://github.com/sabinadams/aurora/commit/acb020d868f2ba16b114cf084b959b65d0294a73#diff-8f1b0a136f29e1af67b019f53772aa2e80bf4d24e2c8b844cfa993d8cc9df789
function getModelFieldMappings(datamodel: string): Record<string, Record<string, string>> {
  // Split the schema up by the ending of each block and then keep each starting with 'model'
  // This should essentially give us an array of the model blocks
  const modelChunks = datamodel.split('\n}');
  return modelChunks.reduce((modelDefinitions: { [k: string]: any }, modelChunk: string) => {
    // Split the model chunk by line to get the individual fields
    let pieces = modelChunk.split('\n').filter((chunk) => chunk.trim().length);
    // Pull out model name
    const modelName = pieces.find(name=>name.match(/model (.*) {/))?.split(' ')[1];
    if(!modelName) return modelDefinitions;
    // Regex for getting our @map attribute
    const mapRegex = new RegExp(/[^@]@map/);
    // Get all of the model's fields out that have the @map attribute
    const fieldsWithMappings = pieces
      // Clean up new lines and spaces out of the string
      .map((field) => field.replace(/\t/g, '').trim())
      // Get rid of any fields that don't even have a @map
      .filter((field) => mapRegex.test(field));  
    // Add an index to the reduced array named the model's name
    // The value is an object whose keys are field names and their values are mapping names
    modelDefinitions[modelName] = fieldsWithMappings.reduce(
      (mappings: { [key: string]: any }, field) => ({
        ...mappings,
        [field.trim().split(' ')[0]]: field.split('@map("')[1].split('"')[0]
      }),
      {}
    );
    return modelDefinitions;
  }, {});
}

export async function prismix(options: PrismixOptions) {
  for (const mixer of options.mixers) {
    const schemasToMix: Schema[] = [];

    // load the schema data for all inputs
    for (const input of mixer.input) {
      for (const file of glob.sync(input)) {
        const parsedSchema = await getSchema(file);
        if (parsedSchema) schemasToMix.push(parsedSchema);
      }
    }

    // extract all models and mix
    let models: Model[] = [];
    for (const schema of schemasToMix) models = [...models, ...schema.models];
    models = mixModels(models);

    let enums: DMMF.DatamodelEnum[] = [];
    schemasToMix.forEach((schema) => !!schema.enums && (enums = [...enums, ...schema.enums]));

    // use the last found datasources
    let datasources: DataSource[] = [];
    schemasToMix.forEach(
      (schema) =>
        schema.datasources.length > 0 &&
        schema.datasources.filter((d) => d.url.value).length > 0 &&
        (datasources = schema.datasources)
    );
    // use the last found generators
    let generators: GeneratorConfig[] = [];
    schemasToMix.forEach(
      (schema) => schema.generators.length > 0 && (generators = schema.generators)
    );

    let outputSchema = [
      '// *** GENERATED BY PRISMIX :: DO NOT EDIT ***',
      await deserializeDatasources(datasources),
      await deserializeGenerators(generators),
      await deserializeModels(models),
      await deserializeEnums(enums)
    ]
      .filter((e) => e)
      .join('\n');

    await writeFile(path.join(process.cwd(), mixer.output), outputSchema);
  }
}

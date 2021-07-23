import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import jsonfile from 'jsonfile';
import { getDMMF, getConfig } from '@prisma/sdk';
import {
  deserializeEnums,
  deserializeDatasources,
  deserializeModels,
  deserializeGenerators,
  Model
} from './deserializer';
import { DataSource, DMMF, GeneratorConfig } from '@prisma/generator-helper/dist';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readJsonFile = promisify(jsonfile.readFile);

interface MixerOptions {
  input: string[];
  output: string;
}

interface PrismixOptions {
  mixers: MixerOptions[];
}

type UnPromisify<T> = T extends Promise<infer U> ? U : T;

type Schema = UnPromisify<ReturnType<typeof getSchema>>;

function mixModels(inputModels: Model[]) {
  const models: Record<string, Model> = {};
  for (const newModel of inputModels) {
    type Field = typeof newModel.fields[0];

    const existingModel: Model | null = models[newModel.name];

    // if the model already exists in our found models, merge the fields
    if (existingModel) {
      const existingFieldNames = existingModel.fields.map((f) => f.name);
      for (const newField of newModel.fields) {
        // if this field exists in the existing model
        if (existingFieldNames.includes(newField.name)) {
          const existingFieldIndex: number = existingFieldNames.indexOf(newField.name);
          // replace the field at this index with the new one
          existingModel.fields[existingFieldIndex] = newField;
        } else {
          // if it doesn't already exist, append to field list
          existingModel.fields.push(newField);
        }
      }
    } else {
      models[newModel.name] = newModel;
    }
  }
  return Object.values(models);
}

export async function prismix() {
  const options: PrismixOptions = (await readJsonFile(
    path.join(process.cwd(), 'prismix.config.json')
  )) as PrismixOptions;

  console.log({ options });

  for (const mixer of options.mixers) {
    const schemasToMix: Schema[] = [];

    // load the schema data for all inputs
    for (const input of mixer.input) schemasToMix.push(await getSchema(input));

    // extract all models and mix
    let models: Model[] = [];
    for (const schema of schemasToMix) models = [...models, ...schema.models];
    models = mixModels(models);

    let enums: DMMF.DatamodelEnum[] = [];
    schemasToMix.forEach((schema) => !!schema.enums && (enums = [...enums, ...schema.enums]));

    // use the last found datasources
    let datasources: DataSource[] = [];
    schemasToMix.forEach(
      (schema) => schema.datasources.length > 0 && (datasources = schema.datasources)
    );
    // use the last found generators
    let generators: GeneratorConfig[] = [];
    schemasToMix.forEach(
      (schema) => schema.generators.length > 0 && (generators = schema.generators)
    );

    let outputSchema = [
      await deserializeDatasources(datasources),
      await deserializeGenerators(generators),
      await deserializeModels(models),
      await deserializeEnums(enums)
    ]
      .filter((e) => e)
      .join('\n\n\n');

    await writeFile(path.join(process.cwd(), mixer.output), outputSchema);
  }
}

async function getSchema(schemaPath: string) {
  const schema = await readFile(path.join(process.cwd(), schemaPath), {
    encoding: 'utf-8'
  });

  const dmmf = await getDMMF({ datamodel: schema });
  const config = await getConfig({ datamodel: schema });

  const models = dmmf.datamodel.models as Model[];
  const enums = dmmf.datamodel.enums;
  const datasources = config.datasources;
  const generators = config.generators;

  return { models, enums, datasources, generators };
}

prismix();

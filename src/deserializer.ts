import {
  ConnectorType,
  DataSource,
  DMMF,
  EnvValue,
  GeneratorConfig
} from '@prisma/generator-helper/dist';

export interface Field {
  kind: DMMF.FieldKind;
  name: string;
  isRequired: boolean;
  isList: boolean;
  isUnique: boolean;
  isId: boolean;
  type: string;
  dbNames: string[] | null;
  isGenerated: boolean;
  hasDefaultValue: boolean;
  relationFromFields?: any[];
  relationToFields?: any[];
  relationOnDelete?: string;
  relationName?: string;
  default: boolean | any;
  isUpdatedAt: boolean;
  isReadOnly: string;
  columnName?: string;
}

export interface Attribute {
  isUnique: boolean;
  isId: boolean;
  dbNames: string[] | null;
  relationFromFields?: any[];
  relationToFields?: any[];
  relationOnDelete?: string;
  relationName?: string;
  isReadOnly: string;
  default?: boolean | any;
  isGenerated: boolean;
  isUpdatedAt: boolean;
  columnName?: string;
}

export interface Model extends DMMF.Model {
  uniqueFields: string[][];
}

const handlers = (type: any, kind: any) => {
  return {
    default: (value: any) => {
      if (kind === 'enum') {
        return `@default(${value})`;
      }

      if (type === 'Boolean') {
        return `@default(${value})`;
      }

      if (!value) {
        return '';
      }

      if (typeof value === 'object') {
        return `@default(${value.name}(${value.args}))`;
      }

      if (typeof value === 'number') {
        return `@default(${value})`;
      }

      if (typeof value === 'string') {
        return `@default("${value}")`;
      }

      throw new Error(`Unsupported field attribute ${value}`);
    },
    isId: (value: any) => (value ? '@id' : ''),
    isUnique: (value: any) => (value ? '@unique' : ''),
    dbNames: (value: any) => {},
    relationToFields: (value: any) => {},
    relationOnDelete: (value: any) => {},
    hasDefaultValue: (value: any) => {},
    relationName: (value: any) => {},
    documentation: (value: any) => {},
    isReadOnly: (value: any) => {},
    isGenerated: (value: any) => {},
    isUpdatedAt: (value: any) => (value ? '@updatedAt' : ''),
    columnName: (value: any) => (value ? `@map("${value}")` : '')
  };
};

// Handler for Attributes
// https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema/data-model#attributes
function handleAttributes(attributes: Attribute, kind: DMMF.FieldKind, type: string) {
  const { relationFromFields, relationToFields, relationName } = attributes;
  if (kind === 'scalar') {
    return `${Object.keys(attributes)
      .map((each) => handlers(type, kind)[each](attributes[each]))
      .join(' ')}`;
  }

  if (kind === 'object' && relationFromFields) {
    return relationFromFields.length > 0
      ? `@relation(name: "${relationName}", fields: [${relationFromFields}], references: [${relationToFields}])`
      : `@relation(name: "${relationName}")`;
  }

  if (kind === 'enum')
    return `${Object.keys(attributes)
      .map((each) => handlers(type, kind)[each](attributes[each]))
      .join(' ')}`;

  return '';
}

function handleFields(fields: Field[]) {
  return fields
    .map((fields) => {
      const { name, kind, type, isRequired, isList, ...attributes } = fields;
      if (kind === 'scalar') {
        return `  ${name} ${type}${isRequired ? '' : '?'} ${handleAttributes(
          attributes,
          kind,
          type
        )}`;
      }

      if (kind === 'object') {
        return `  ${name} ${type}${isList ? '[]' : isRequired ? '' : '?'} ${handleAttributes(
          attributes,
          kind,
          type
        )}`;
      }

      if (kind === 'enum') {
        return `  ${name} ${type}${isList ? '[]' : isRequired ? '' : '?'} ${handleAttributes(
          attributes,
          kind,
          type
        )}`;
      }

      throw new Error(`Unsupported field kind "${kind}"`);
    })
    .join('\n');
}

function handleIdFields(idFields: string[]) {
  return idFields.length > 0 ? `@@id([${idFields.join(', ')}])` : '';
}

function handleUniqueFields(uniqueFields: string[][]) {
  return uniqueFields.length > 0
    ? uniqueFields.map((eachUniqueField) => `@@unique([${eachUniqueField.join(', ')}])`).join('\n')
    : '';
}

function handleDbName(dbName: string | null) {
  return dbName ? `@@map("${dbName}")` : '';
}

function handleUrl(envValue: EnvValue) {
  const value = envValue.fromEnvVar ? `env("${envValue.fromEnvVar}")` : envValue.value;

  return `url = "${value}"`;
}

function handleProvider(provider: ConnectorType | string) {
  return `provider = "${provider}"`;
}

function handleOutput(path: string | null) {
  return path ? `output = "${path}"` : '';
}

function handleBinaryTargets(binaryTargets?: string[]) {
  return binaryTargets?.length ? `binaryTargets = ${JSON.stringify(binaryTargets)}` : '';
}

function handlePreviewFeatures(previewFeatures: GeneratorConfig['previewFeatures']) {
  return previewFeatures.length ? `previewFeatures = ${JSON.stringify(previewFeatures)}` : '';
}

function deserializeModel(model: Model) {
  const { name, uniqueFields, dbName, idFields } = model;
  const fields = model.fields as unknown as Field[];

  const output = `
model ${name} {
${handleFields(fields)}
${handleUniqueFields(uniqueFields)}
${handleDbName(dbName)}
${handleIdFields(idFields)}
}`;
  return output;
}

function deserializeDatasource(datasource: DataSource) {
  const { activeProvider: provider, name, url } = datasource;

  return `
datasource ${name} {
	${handleProvider(provider)}
	${handleUrl(url)}
}`;
}

function deserializeGenerator(generator: GeneratorConfig) {
  const { binaryTargets, name, output, provider, previewFeatures } = generator;

  return `
generator ${name} {
	${handleProvider(provider.value)}
	${handleOutput(output?.value || null)}
	${
    //@ts-ignore
    handleBinaryTargets(binaryTargets)
  }
	${handlePreviewFeatures(previewFeatures)}
}`;
}

function deserializeEnum({ name, values, dbName }: DMMF.DatamodelEnum) {
  const outputValues = values.map(({ name, dbName }) => {
    let result = name;
    if (name !== dbName && dbName) result += `@map("${dbName}")`;
    return result;
  });
  return `
enum ${name} {
	${outputValues.join('\n\t')}
	${handleDbName(dbName || null)}
}`;
}

/**
 * Deserialize DMMF.Model[] into prisma schema file
 */
export async function deserializeModels(models: Model[]) {
  return models.map((model) => deserializeModel(model)).join('\n');
}

export async function deserializeDatasources(datasources: DataSource[]) {
  return datasources.map((datasource) => deserializeDatasource(datasource)).join('\n');
}

export async function deserializeGenerators(generators: GeneratorConfig[]) {
  return generators.map((generator) => deserializeGenerator(generator)).join('\n');
}

export async function deserializeEnums(enums: DMMF.DatamodelEnum[]) {
  return enums.map((each) => deserializeEnum(each)).join('\n');
}
// Adapted from https://github.com/IBM/prisma-schema-transformer/blob/53a173185b/src/deserializer.ts

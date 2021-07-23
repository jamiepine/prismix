import {
  ConnectorType,
  DataSource,
  DMMF,
  EnvValue,
  GeneratorConfig
} from '@prisma/generator-helper/dist';

const handlers = (type: any, kind: any) => {
  return {
    default: (value: any) => {
      if (kind === 'enum') return `@default(${value})`;
      if (type === 'Boolean') return `@default(${value})`;
      if (!value) return '';
      if (typeof value === 'object') return `@default(${value.name}(${value.args}))`;
      if (typeof value === 'number') return `@default(${value})`;
      if (typeof value === 'string') return `@default("${value}")`;
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

function handleAttributes(attributes: DMMF.Field, kind: DMMF.FieldKind, type: string) {
  const { relationFromFields, relationToFields, relationName } = attributes;

  if (kind == 'scalar' || kind == 'enum') {
    return `${Object.keys(attributes)
      .map((each) => {
        const func = handlers(type, kind)[each];
        if (typeof func == 'function') return func(attributes[each]);
        else return false;
      })
      .filter((x) => !!x)
      .join(' ')}`;
  }

  if (kind === 'object' && relationFromFields) {
    return relationFromFields.length > 0
      ? `@relation(name: "${relationName}", fields: [${relationFromFields}], references: [${relationToFields}])`
      : `@relation(name: "${relationName}")`;
  }

  return '';
}

function handleFields(fields: DMMF.Field[]): string[] {
  return fields.map((field) => {
    const { name, kind, type, isRequired, isList } = field;

    if (kind == 'scalar') {
      return `${name} ${type}${isRequired ? '' : '?'} ${handleAttributes(field, kind, type)}`;
    }

    if (kind == 'object' || kind == 'enum') {
      return `${name} ${type}${isList ? '[]' : isRequired ? '' : '?'} ${handleAttributes(
        field,
        kind,
        type
      )}`;
    }

    throw new Error(`Prismix: Unsupported field kind "${kind}"`);
  });
}

function assembleBlock(type: string, name: string, things: string[]) {
  return `${type} ${name} {\n${things
    .filter((thing) => thing.length > 1)
    .map((thing) => `\t${thing}`)
    .join('\n')}\n}`;
}

function deserializeModel(model: DMMF.Model) {
  const { name, fields, uniqueFields, dbName, idFields } = model;

  return assembleBlock('model', name, [
    ...handleFields(fields),
    ...handleUniqueFields(uniqueFields),
    handleDbName(dbName),
    handleIdFields(idFields)
  ]);
}

function deserializeDatasource(datasource: DataSource) {
  const { activeProvider: provider, name, url } = datasource;
  return assembleBlock('datasource', name, [handleProvider(provider), handleUrl(url)]);
}

function deserializeGenerator(generator: GeneratorConfig) {
  const { binaryTargets, name, output, provider, previewFeatures } = generator;

  return assembleBlock('generator', name, [
    handleProvider(provider.value),
    handleOutput(output?.value || null),
    handleBinaryTargets(binaryTargets as unknown as string[]),
    handlePreviewFeatures(previewFeatures)
  ]);
}

function deserializeEnum({ name, values, dbName }: DMMF.DatamodelEnum) {
  const outputValues = values.map(({ name, dbName }) => {
    let result = name;
    if (name !== dbName && dbName) result += `@map("${dbName}")`;
    return result;
  });
  return assembleBlock('enum', name, [...outputValues, handleDbName(dbName || null)]);
}

function handleIdFields(idFields: string[]) {
  return idFields.length > 0 ? `@@id([${idFields.join(', ')}])` : '';
}

function handleUniqueFields(uniqueFields: string[][]): string[] {
  return uniqueFields.length > 0
    ? uniqueFields.map((eachUniqueField) => `@@unique([${eachUniqueField.join(', ')}])`)
    : [];
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

export async function deserializeModels(models: DMMF.Model[]) {
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

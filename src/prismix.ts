import fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import prismaSDK, { getDMMF, getConfig } from '@prisma/sdk';
import {
  deserializeEnums,
  deserializeDatasources,
  deserializeModels,
  deserializeGenerators,
  Model
} from './deserializer';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export async function prismix() {
  const schema = await readFile(path.join(__dirname, '../', 'example/schema1.prisma'), {
    encoding: 'utf-8'
  });

  const dmmf = await getDMMF({ datamodel: schema });
  const config = await getConfig({ datamodel: schema });

  const models = dmmf.datamodel.models as Model[];
  const enums = dmmf.datamodel.enums;
  const datasources = config.datasources;
  const generators = config.generators;

  let outputSchema = [
    await deserializeDatasources(datasources),
    await deserializeGenerators(generators),
    await deserializeModels(models),
    await deserializeEnums(enums)
  ]
    .filter((e) => e)
    .join('\n\n\n');

  await writeFile(path.join(__dirname, '../', 'example/schema.prisma'), outputSchema);
}

prismix();

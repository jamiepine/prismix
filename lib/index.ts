import { Command, flags } from '@oclif/command';
import { prismix, PrismixOptions } from './prismix';
import { promisify } from 'util';
import jsonfile from 'jsonfile';
import path from 'path';

const readJsonFile = promisify(jsonfile.readFile);

class Prismix extends Command {
  static description =
    'Allows you to have multiple Prisma schema files with shared model relations.';

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' })
  };

  async run() {
    this.log(``);
    // const { flags } = this.parse(Prismix)

    const options: PrismixOptions = (await readJsonFile(
      path.join(process.cwd(), 'prismix.config.json')
    )) as PrismixOptions;

    await prismix(options);
  }
}

export = Prismix;

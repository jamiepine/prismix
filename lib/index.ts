import { Command, flags } from '@oclif/command';
import { prismix, PrismixOptions } from './prismix';
import { promisify } from 'util';
import jsonfile from 'jsonfile';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const readJsonFile = promisify(jsonfile.readFile);

const args = process.argv.slice(2);

class Prismix extends Command {
  static description =
    'Allows you to have multiple Prisma schema files with shared model relations.';

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' })
  };

  async run() {
    this.log(`Prismix: mixing your schemas... 🍹`);
    // const { flags } = this.parse(Prismix)

    const options: PrismixOptions = (await readJsonFile(
      path.join(process.cwd(), args[0] || 'prismix.config.json')
    )) as PrismixOptions;

    for (const mixer of options.mixers) {
      if (!mixer.output) mixer.output = 'prisma/schema.prisma';
    }

    await prismix(options);
  }
}

export = Prismix;

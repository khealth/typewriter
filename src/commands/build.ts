import * as fs from "fs";
import * as path from "path";

import { CliUx, Flags } from "@oclif/core";
import chalk from "chalk";
import { RendererOptions } from "quicktype-core";

import { loadTrackingPlans } from "../api";
import { BaseCommand } from "../base-command";
import {
  resolveRelativePath,
  runScript,
  Scripts,
  TrackingPlanConfig,
  verifyDirectoryExists,
} from "../config";
import { supportedLanguages } from "../languages";
import { CommandBuild, Mode, toCommandConfig } from "../telemetry";

const FILE_HEADER = [
  "This client was automatically generated by Segment Typewriter. ** Do Not Edit **",
  "To update this file, run:",
  "  npx typewriter",
];

export default class Build extends BaseCommand {
  static description = "Generates types and functions for your tracking plan";

  static aliases: string[] = ["b"];

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> -u",
    "<%= config.bin %> <%= command.id %> -m prod -u",
  ];

  static flags = {
    ...BaseCommand.flags,
    update: Flags.boolean({
      char: "u",
      default: false,
      description: "Download the latest Tracking Plan version from Segment",
    }),
    mode: Flags.enum({
      options: ["dev", "prod"],
      default: "dev",
      required: false,
      char: "m",
      description:
        "Switch between production more or development mode (with additional validation generated for some languages)",
    }),
  };

  // clearFolder removes all typewriter-generated files from the specified folder
  // except for a plan.json.
  // It uses a simple heuristic to avoid accidentally clobbering a user's files --
  // it only clears files with the "this file was autogenerated by Typewriter" warning.
  // Therefore, all generators need to output that warning in a comment in the first few
  // lines of every generated file.
  private clearFolder(dir: string) {
    const fileNames = fs.readdirSync(dir, "utf-8");
    for (const fileName of fileNames) {
      const fullPath = path.join(dir, fileName);
      try {
        const contents = fs.readFileSync(fullPath, "utf-8");
        if (contents.includes(FILE_HEADER[0])) {
          this.debug("Deleting file:", fullPath);
          fs.unlinkSync(fullPath);
        }
      } catch (error) {
        // Note: none of our generators produce folders, but if we ever do, then we'll need to
        // update this logic to handle recursively traversing directores. For now, we just ignore
        // any directories.
        throw error;
      }
    }
  }

  private async clearGeneratedFiles(
    trackingPlanConfig: TrackingPlanConfig
  ): Promise<void> {
    const path = resolveRelativePath(this.configPath, trackingPlanConfig.path);
    await verifyDirectoryExists(path);
    try {
      this.debug("Clearing directory:", path);
      await this.clearFolder(path);
    } catch (error) {
      this.debug(
        `Failed to clear generated files in: '${trackingPlanConfig.path}'`
      );
    }
  }

  public async run(): Promise<void> {
    const startTime = process.hrtime();
    const { flags } = await this.parse(this.constructor as typeof Build);
    // Check we have all the information we need
    if (this.apiToken === undefined) {
      this.warn(
        `No API token found at ${this.configPath}. Using local copy of tracking plans instead.`
      );
    }

    if (this.workspaceConfig === undefined) {
      this.error(
        `No workspace config found at ${this.configPath}. Run init first to generate a configuration file.`
      );
    }

    const configPlans = this.workspaceConfig?.trackingPlans ?? [];

    if (configPlans.length === 0) {
      this.error(
        `No tracking plans found on ${this.configPath}. Run init first to generate a config file.`
      );
    }

    CliUx.ux.action.start("Loading tracking plans");

    const trackingPlans = await loadTrackingPlans(
      this.apiToken!,
      this.configPath,
      this.workspaceConfig.trackingPlans,
      flags.update
    );

    this.debug("Loaded Tracking Plans:\n", trackingPlans);

    CliUx.ux.action.stop(chalk.green(`Loaded`));

    const { language, sdk, languageOptions } = this.workspaceConfig.client;
    const languageGenerator = supportedLanguages.find(
      (lang) => lang.id === language
    );
    if (languageGenerator === undefined) {
      this.error(`Could not find a language generator for: ${language}`);
    }

    this.debug(
      `Generating code. Language: ${language}, SDK: ${sdk} Options:`,
      languageOptions
    );

    CliUx.ux.action.start("Generating files");
    for (const plan of trackingPlans) {
      if (plan.rules === undefined || plan.rules.length === 0) {
        CliUx.ux.action.status = chalk.yellow(
          `No rules found for ${plan.name}. Skipping...`
        );
        continue;
      }

      try {
        const files = await languageGenerator.generate(
          plan.rules ?? [],
          {
            version: this.config.version,
            isDevelopment: flags.mode === "dev",
          },
          {
            header: FILE_HEADER,
            outputFilename: "segment",
            sdk: sdk,
            ...(languageOptions as RendererOptions),
          }
        );

        const workspacePlan = this.workspaceConfig.trackingPlans.find(
          (tp) => tp.id === plan.id || tp.legacyID === plan.id
        );

        await this.clearGeneratedFiles(workspacePlan!);

        for (const [filename, contents] of files.entries()) {
          // Not all quicktype languages add their extensions in the filenames returned so we check here to add it ourselves
          let fileWithExtension = `${filename}`;
          if (path.extname(filename) === "") {
            fileWithExtension += `.${languageGenerator.extension}`;
          }

          const filepath = resolveRelativePath(
            this.configPath,
            workspacePlan!.path,
            fileWithExtension
          );
          this.debug(`Writing to ${filepath}`);
          await verifyDirectoryExists(filepath, "file");
          fs.writeFileSync(filepath, contents, {
            encoding: "utf-8",
          });
        }
      } catch (error) {
        CliUx.ux.action.stop(chalk.red("Error!"));
        this.error(error as Error, {
          message: `Failed to generate language for ${plan.name}: ${error}`,
        });
      }
    }
    CliUx.ux.action.stop(chalk.green(`Done`));

    this.segmentClient.buildCommand({
      properties: {
        config: toCommandConfig(
          this.workspaceConfig,
          this.tokenMetadata?.method
        ),
        isCI: this.isCI,
        mode: flags.mode === "dev" ? Mode.Dev : Mode.Prod,
        workspace: this.workspace?.id,
        duration: process.hrtime(startTime)[1],
        rawCommand: this.rawCommand,
      } as CommandBuild,
    });

    const afterScript = this.workspaceConfig.scripts?.after;
    if (afterScript !== undefined) {
      CliUx.ux.action.start(`Running After Script: ${chalk.blue(afterScript)}`);
      await runScript(afterScript, this.configPath, Scripts.After);
      CliUx.ux.action.stop(chalk.green(`Done`));
    }
  }
}

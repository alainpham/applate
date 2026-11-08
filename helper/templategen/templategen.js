const AdmZip = require("adm-zip");
const fs = require("fs/promises");
const path = require("path");
const { isUtf8 } = require("node:buffer");

async function unzipAndProcess(zipFilePath, outputDir, replacements) {
  try {
    // Ensure the output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Extract the ZIP file
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();
    // Match longer keys first and replace in one pass so supplied values are
    // literal and never processed again by another substitution.
    const pattern = new RegExp([...replacements.keys()]
      .sort((a, b) => b.length - a.length)
      .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|"), "g");
    const substitute = value => value.replace(pattern, match => replacements.get(match));
    const root = path.resolve(outputDir);

    console.log(`Extracting files from ${zipFilePath}...`);

    // Process each entry in the ZIP
    for (const entry of zipEntries) {
      const relativePath = entry.entryName;
      const updatedPath = substitute(relativePath);
      const outputPath = path.resolve(root, updatedPath);
      if (outputPath !== root && !outputPath.startsWith(root + path.sep)) {
        throw new Error(`Output path escapes destination: ${updatedPath}`);
      }

      if (entry.isDirectory) {
        // Create the renamed directory
        await fs.mkdir(outputPath, { recursive: true });
        console.log(`Created directory: ${outputPath}`);
      } else {
        // Only substitute text; decoding binary assets as UTF-8 corrupts them.
        const content = entry.getData();
        const updatedContent = isUtf8(content) && !content.includes(0)
          ? substitute(content.toString("utf8"))
          : content;

        // Write the updated file
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, updatedContent);
        console.log(`Processed file: ${outputPath}`);
      }
    }

    console.log("Unzipping and processing completed successfully.");
  } catch (error) {
    console.error("Error during unzipping and processing:", error);
    process.exitCode = 1;
  }
}

// Get command-line arguments
const [zipFilePath, ...substitutions] = process.argv.slice(2);

// Validate arguments
if (!zipFilePath || substitutions.length < 2 || substitutions.length % 2 !== 0
    || substitutions.some(value => !value)) {
  console.error(
    "Usage: node templategen.js <zipFilePath> <searchString> <replacementString> [<searchString> <replacementString> ...]"
  );
  process.exit(1);
}
const replacements = new Map();
for (let i = 0; i < substitutions.length; i += 2) {
  if (replacements.has(substitutions[i])) {
    console.error(`Duplicate search string: ${substitutions[i]}`);
    process.exit(1);
  }
  replacements.set(substitutions[i], substitutions[i + 1]);
}

// Generate the project in the caller's working directory.
const outputDir = "./";

// Execute the function
unzipAndProcess(zipFilePath, outputDir, replacements);

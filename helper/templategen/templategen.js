const AdmZip = require("adm-zip");
const fs = require("fs/promises");
const path = require("path");
const { isUtf8 } = require("node:buffer");

async function unzipAndProcess(zipFilePath, outputDir, searchString, replacementString) {
  try {
    // Ensure the output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Extract the ZIP file
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    console.log(`Extracting files from ${zipFilePath}...`);

    // Process each entry in the ZIP
    for (const entry of zipEntries) {
      const relativePath = entry.entryName;
      const updatedPath = relativePath.replace(searchString, replacementString);
      const outputPath = path.join(outputDir, updatedPath);

      if (entry.isDirectory) {
        // Create the renamed directory
        await fs.mkdir(outputPath, { recursive: true });
        console.log(`Created directory: ${outputPath}`);
      } else {
        // Only substitute text; decoding binary assets as UTF-8 corrupts them.
        const content = entry.getData();
        const updatedContent = isUtf8(content) && !content.includes(0)
          ? content.toString("utf8").replace(
              new RegExp(searchString, "g"),
              replacementString
            )
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
  }
}

// Get command-line arguments
const [zipFilePath, searchString, replacementString] = process.argv.slice(2);

// Validate arguments
if (!zipFilePath || !searchString || !replacementString) {
  console.error(
    "Usage: node script.js <zipFilePath> <searchString> <replacementString>"
  );
  process.exit(1);
}

// Define output directory based on zipFilePath
const outputDir = "./"

// Execute the function
unzipAndProcess(zipFilePath, outputDir, searchString, replacementString);

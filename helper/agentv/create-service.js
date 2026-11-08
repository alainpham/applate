const AdmZip = require("adm-zip");
const fs = require("fs/promises");
const path = require("path");

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
        // Read file content, replace occurrences, and write to a new file
        const content = entry.getData().toString();
        const updatedContent = content.replace(
          new RegExp(searchString, "g"),
          replacementString
        );

        // Write the updated file
        await fs.writeFile(outputPath, updatedContent, "utf8");
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

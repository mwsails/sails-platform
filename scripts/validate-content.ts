import { validateContent } from "../src/lib/content/validate";

const issues = validateContent();

if (issues.length === 0) {
  console.log("content:validate — OK, no issues found.");
  process.exit(0);
}

console.error(`content:validate — ${issues.length} issue(s):\n`);
for (const issue of issues) {
  console.error(`  ${issue.file}: ${issue.message}`);
}
process.exit(1);

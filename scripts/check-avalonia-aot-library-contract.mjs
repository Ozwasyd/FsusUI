import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicPackages = [
  'dotnet/FsusUI.Avalonia/FsusUI.Avalonia.csproj',
  'dotnet/FsusUI.Avalonia.Themes/FsusUI.Avalonia.Themes.csproj',
  'dotnet/FsusUI.Avalonia.Icons/FsusUI.Avalonia.Icons.csproj',
];
const forbiddenProjectProperties = [
  /<PublishAot(?:\s|>)/i,
  /<SuppressTrimAnalysisWarnings>\s*true\s*<\/SuppressTrimAnalysisWarnings>/i,
  /<NoWarn>[^<]*\bIL\d*\*?[^<]*<\/NoWarn>/i,
  /<TrimmerRootAssembly(?:\s|>)/i,
];

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

const failures = [];
for (const project of publicPackages) {
  const text = await source(project);
  if (!/<IsAotCompatible>\s*true\s*<\/IsAotCompatible>/i.test(text)) {
    failures.push(`${project} must declare IsAotCompatible=true`);
  }
  for (const pattern of forbiddenProjectProperties) {
    if (pattern.test(text)) failures.push(`${project} contains a forbidden AOT/trimming escape hatch`);
  }
}

const directoryProps = await source('dotnet/Directory.Build.props');
if (/<IsAotCompatible>\s*true\s*<\/IsAotCompatible>/i.test(directoryProps)) {
  failures.push('dotnet/Directory.Build.props must not globally declare IsAotCompatible=true');
}
if (/<SuppressTrimAnalysisWarnings>\s*true\s*<\/SuppressTrimAnalysisWarnings>/i.test(directoryProps) || /<NoWarn>[^<]*\bIL\d*\*?[^<]*<\/NoWarn>/i.test(directoryProps)) {
  failures.push('dotnet/Directory.Build.props must not globally suppress trimming or AOT warnings');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Avalonia public NuGet library AOT contract is satisfied.');
}

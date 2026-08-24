#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = path.join(root, 'tests/fixtures/avalonia-aot-smoke')
const readFixture = (name) => readFileSync(path.join(fixtureRoot, name), 'utf8')

const project = readFixture('FsusUI.Avalonia.AotSmoke.csproj')
const nugetConfig = readFixture('NuGet.Config')
const program = readFixture('Program.cs')

assert.match(project, /<PublishAot>true<\/PublishAot>/u)
assert.match(project, /<PackageReference Include="FsusUI\.Avalonia"/u)
assert.match(project, /<PackageReference Include="FsusUI\.Avalonia\.Themes"/u)
assert.match(project, /<PackageReference Include="FsusUI\.Avalonia\.Icons"/u)
assert.doesNotMatch(project, /<ProjectReference\b/u)
assert.match(nugetConfig, /<clear\s*\/>/u)
assert.match(nugetConfig, /dotnet\/artifacts\/nuget/u)
assert.match(program, /--smoke/u)
assert.match(program, /--report/u)
assert.match(program, /Dispatcher/u)
assert.match(program, /TopLevel|Window/u)
assert.match(program, /JsonSerializer/u)

console.log('Avalonia Native AOT smoke fixture contract is defined.')

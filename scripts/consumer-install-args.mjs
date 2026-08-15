const PROFILES = new Set(['npm-latest', 'pnpm-latest', 'npm-peer-floor'])

export const parseConsumerInstallArgs = (
  argv,
  env = process.env,
) => {
  const flags = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--') {
      continue
    }
    if (token === '--profile' || token === '--candidate') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`${token} requires a value`)
      }
      flags[token.slice(2)] = value
      index += 1
      continue
    }
    if (token.startsWith('--')) {
      throw new Error(`unknown consumer-install flag: ${token}`)
    }
  }

  const envProfile = env.FSUS_CONSUMER_PROFILE
  const envCandidate = env.FSUSUI_NPM_CANDIDATE
  if (flags.profile && envProfile && flags.profile !== envProfile) {
    throw new Error('--profile and FSUS_CONSUMER_PROFILE must resolve to the same profile')
  }
  if (flags.candidate && envCandidate) {
    // identity compared by the caller after path.resolve
  }

  const profile = flags.profile ?? envProfile
  const candidate = flags.candidate ?? envCandidate
  if (!profile) {
    throw new Error('--profile is required')
  }
  if (!candidate) {
    throw new Error('--candidate is required')
  }
  if (!PROFILES.has(profile)) {
    throw new Error(`unknown consumer profile: ${profile}`)
  }

  return { profile, candidate }
}

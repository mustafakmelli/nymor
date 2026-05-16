interface AddOptions {
  version?: string;
}

export async function addCommand(skill: string, options: AddOptions): Promise<void> {
  const version = options.version ? `@${options.version}` : "";
  console.log(`Registry install not implemented yet: ${skill}${version}`);
  process.exitCode = 1;
}

export async function updateCommand(skill?: string): Promise<void> {
  const target = skill ?? "all skills";
  console.log(`Update not implemented yet: ${target}`);
  process.exitCode = 1;
}

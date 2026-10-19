/** SVG 1.1 uses XML 1.0 character rules. Reject text that would make an export unreadable. */
export function assertXMLText(value: string, name: string): void {
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (
      (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      (code >= 0xd800 && code <= 0xdfff) ||
      code === 0xfffe ||
      code === 0xffff
    ) {
      throw new Error(
        `${name} contains an unsupported control character. Remove it before importing or exporting.`,
      );
    }
  }
}

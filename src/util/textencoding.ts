export function makeUnicodeSuffixReadable(input: string): string {
    let text = input;
    const chars: string[] = [];
    const hexPattern = /_[0-9A-Fa-f]{4}$/;
    while (hexPattern.test(text)) {
        const hexCode = text.slice(-4);
        const charCode = parseInt(hexCode, 16);
        chars.unshift(String.fromCharCode(charCode));
        text = text.slice(0, -5);
    }
    if (chars.length > 0) {
        text += " " + chars.join('');
    }
    return text;
}
export function normalizeKGPhone(input) {
  const raw = String(input || "").trim();

  // оставляем только цифры
  const digits = raw.replace(/\D/g, "");

  // варианты:
  // 996701123456
  // 0701123456
  // 701123456
  // +996701123456 (после replace станет 996701123456)
  if (digits.startsWith("996") && digits.length === 12) {
    return "+" + digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    // 0701123456 -> +996701123456
    return "+996" + digits.slice(1);
  }

  if (!digits.startsWith("0") && digits.length === 9) {
    // 701123456 -> +996701123456
    return "+996" + digits;
  }

  throw new Error("INVALID_PHONE");
}
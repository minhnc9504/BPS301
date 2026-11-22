export const maxJsonBytes = 10 * 1024 * 1024

export async function readJsonFile(file: Pick<File, 'name' | 'size' | 'text'>): Promise<unknown> {
  if (!/\.json$/i.test(file.name)) throw new Error('Hãy chọn tệp có đuôi .json.')
  if (!file.size || file.size > maxJsonBytes) throw new Error('Tệp JSON trống hoặc vượt 10 MB.')
  const text = await file.text()
  try { return JSON.parse(text.replace(/^\uFEFF/, '')) }
  catch { throw new Error('Tệp sai cú pháp JSON. Hãy kiểm tra dấu ngoặc, dấu phẩy và dấu nháy kép.') }
}

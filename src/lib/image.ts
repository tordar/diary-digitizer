import sharp from 'sharp'
import { copyFile, mkdir } from 'fs/promises'
import { dirname, basename, join } from 'path'

const DATA_DIR = process.env.DATA_DIR ?? './data'

export async function optimiseForWeb(
  sourcePath: string,
  outputRelPath: string
): Promise<string> {
  const fullOutput = join(DATA_DIR, 'images', outputRelPath)
  await mkdir(dirname(fullOutput), { recursive: true })

  await sharp(sourcePath)
    .rotate() // auto-rotate based on EXIF
    .resize({ width: 1800, withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toFile(fullOutput)

  return fullOutput
}

export async function moveToProcessed(
  sourcePath: string,
  destRelPath: string
): Promise<string> {
  const fullDest = join(DATA_DIR, 'processed', destRelPath)
  await mkdir(dirname(fullDest), { recursive: true })
  await copyFile(sourcePath, fullDest)
  return fullDest
}

export const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.heic', '.pdf',
])

export function isSupported(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return SUPPORTED_EXTENSIONS.has(ext)
}

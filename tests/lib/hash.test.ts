import { describe, it, expect } from 'vitest'
import { hashFile } from '@/lib/hash'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

describe('hashFile', () => {
  it('returns a 64-character hex string', async () => {
    const path = join(tmpdir(), 'test-hash.txt')
    await writeFile(path, 'hello world')
    const hash = await hashFile(path)
    await unlink(path)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns the same hash for identical content', async () => {
    const path1 = join(tmpdir(), 'test-hash-a.txt')
    const path2 = join(tmpdir(), 'test-hash-b.txt')
    await writeFile(path1, 'same content')
    await writeFile(path2, 'same content')
    const [h1, h2] = await Promise.all([hashFile(path1), hashFile(path2)])
    await Promise.all([unlink(path1), unlink(path2)])
    expect(h1).toBe(h2)
  })

  it('returns different hashes for different content', async () => {
    const path1 = join(tmpdir(), 'test-hash-c.txt')
    const path2 = join(tmpdir(), 'test-hash-d.txt')
    await writeFile(path1, 'content A')
    await writeFile(path2, 'content B')
    const [h1, h2] = await Promise.all([hashFile(path1), hashFile(path2)])
    await Promise.all([unlink(path1), unlink(path2)])
    expect(h1).not.toBe(h2)
  })
})

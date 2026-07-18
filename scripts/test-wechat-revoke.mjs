import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const sourcePath = new URL('../electron/services/wechatRevoke.ts', import.meta.url)
const source = fs.readFileSync(sourcePath, 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const module = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)

const message = (messageKey, serverIdRaw, createTime, rawContent = '') => ({
  messageKey,
  localId: Number(messageKey.replace(/\D/g, '')) || 1,
  serverId: Number(serverIdRaw || 0),
  serverIdRaw,
  localType: rawContent ? 10000 : 1,
  createTime,
  sortSeq: createTime,
  isSend: 0,
  senderUsername: 'wxid_sender',
  parsedContent: rawContent,
  rawContent
})

const original = message('original-1', '130', 10)
const neighbour = message('neighbour-2', '131', 11)
neighbour.localId = 130
const exact = message('revoke-3', '999', 12, '<sysmsg><revokemsg><newmsgid>130</newmsgid></revokemsg></sysmsg>')
assert.equal(module.extractRevokedPlatformMessageId(exact), '130')
assert.equal(module.findExactRevokedOriginal([neighbour, original, exact], exact), original)

const displayOnly = message('revoke-4', '998', 13, '张三撤回了一条消息')
assert.equal(module.extractRevokedPlatformMessageId(displayOnly), undefined)
assert.equal(module.findExactRevokedOriginal([neighbour, original, displayOnly], displayOnly), undefined)
assert.equal(module.messageIdTokens(displayOnly).has('998'), true)

const encoded = message('revoke-5', '997', 14, '&lt;revokemsg&gt;&lt;oldmsgid&gt;000130&lt;/oldmsgid&gt;&lt;/revokemsg&gt;')
assert.equal(module.extractRevokedPlatformMessageId(encoded), '130')

console.log('WeChat retract exact-id fixtures passed')

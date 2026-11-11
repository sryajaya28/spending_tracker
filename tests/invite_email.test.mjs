import assert from 'node:assert';
import { buildInviteEmail, cleanName } from '../supabase/functions/_shared/invite_email.ts';
const base = { inviterName: 'SJ', inviterEmail: 'owner@example.com', role: 'viewer', token: 'TOKEN_abc-123_0123456789', lang: 'en', siteUrl: 'https://stiver.io' };
const en = buildInviteEmail(base);
assert(en.subject.startsWith('🏡 SJ saved you a seat'), en.subject);
assert(en.html.indexOf('owner@example.com') < en.html.indexOf('(SJ)'), 'inviter email comes first');
assert(en.html.includes('href="https://stiver.io/join#t=TOKEN_abc-123_0123456789"'), 'link is exactly site/join#t=token');
assert(en.html.includes('Viewer') && !en.html.includes('Editor:'), 'viewer role text');
assert(buildInviteEmail({ ...base, role: 'editor' }).html.includes('Editor'), 'editor role text');
assert(en.text.includes('https://stiver.io/join#t=TOKEN_abc-123_0123456789') && en.text.includes('1. Tap the button.'), 'plain text part');
assert(!/<img|<script|<style|http:\/\//i.test(en.html), 'no images, scripts, style blocks or insecure links');
const id = buildInviteEmail({ ...base, lang: 'id', role: 'editor' });
assert(id.subject.includes('menyiapkan tempat') && id.html.includes('Gabung ke rumah tangga') && id.html.includes('Editor'), 'Indonesian');
// hostile names never reach the email as markup or links
const bad = buildInviteEmail({ ...base, inviterName: '<b>Evil</b> http://phish.example/login "x"', inviterEmail: 'a@b.co<script>alert(1)</script>' });
assert(!/<script|phish\.example|<b>Evil/i.test(bad.html + bad.subject + bad.text), 'sanitised: ' + bad.subject);
assert(!/[\r\n]/.test(buildInviteEmail({ ...base, inviterName: 'A\r\nBcc: x@y.z' }).subject), 'no line breaks in the subject');
assert(buildInviteEmail({ ...base, inviterName: '' }).subject.includes('owner@example.com'), 'no name: the subject shows the inviter email');
assert.strictEqual(cleanName('x'.repeat(100)).length, 40);
// the subject never lets a look-alike display name pass for Stiver: it shows the inviter's email instead
const spoof = buildInviteEmail({ ...base, inviterName: 'Stiver Security' });
assert(spoof.subject.includes('owner@example.com') && !/Stiver Security/.test(spoof.subject), spoof.subject);
assert(buildInviteEmail({ ...base, inviterName: 'Team Support' }).subject.includes('owner@example.com'));
// the token goes into the link unescaped, so only base64url of a sensible length is accepted
for (const badToken of ['short', 'has space inside_the_token_x', '"><script>alert(1)</script>_______', 'x'.repeat(65)]) assert.throws(() => buildInviteEmail({ ...base, token: badToken }), /token/);
// direction and line-separator characters are stripped from names
assert.strictEqual(cleanName('A\u202eB\u2028C\u200fD'), 'ABCD');
assert(buildInviteEmail({ ...base, lang: 'id', role: 'viewer' }).html.includes('Pelihat'), 'Indonesian Viewer matches the app');
console.log('ok invite_email');

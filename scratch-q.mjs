import pg from "pg";import fs from "fs";
const url=fs.readFileSync(".env.local","utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g,"");
const c=new pg.Client({connectionString:url});await c.connect();
const r=await c.query(`select l.slug, b._path, b.tile_script, t.romaji, t.japanese, t.audio_id is not null aud, b.term_id
from payload.lessons l join payload.lessons_blocks_build_sentence b on b._parent_id=l.id
left join payload.terms t on t.id=b.term_id
where l.slug like 'hiragana-l1%' or l.slug like 'hiragana-l2%' order by l.slug, b._path`);
for(const x of r.rows) console.log(x.slug.slice(9),x._path,x.tile_script,x.term_id,x.romaji,x.japanese,x.aud);
await c.end();

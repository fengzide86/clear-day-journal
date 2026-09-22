import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const diaryEntries=sqliteTable('diary_entries',{
  userId:text('user_id').notNull(),
  day:text('day').notNull(),
  data:text('data').notNull(),
  updatedAt:text('updated_at').notNull(),
},table=>[primaryKey({columns:[table.userId,table.day]})]);

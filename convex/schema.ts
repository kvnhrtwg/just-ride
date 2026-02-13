import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  userData: defineTable({
    userSubject: v.string(),
    ftp: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user_subject', ['userSubject']),
})

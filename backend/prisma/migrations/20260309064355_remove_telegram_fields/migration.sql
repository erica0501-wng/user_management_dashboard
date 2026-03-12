/*
  Warnings:

  - You are about to drop the column `telegramChatId` on the `NotificationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `telegramEnabled` on the `NotificationSettings` table. All the data in the column will be lost.
  - You are about to drop the column `telegramUsername` on the `NotificationSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "NotificationSettings" DROP COLUMN "telegramChatId",
DROP COLUMN "telegramEnabled",
DROP COLUMN "telegramUsername";

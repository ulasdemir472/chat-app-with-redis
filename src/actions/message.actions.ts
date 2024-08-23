"use server"
import { Message } from "@/db/dummy";
import { redis } from "@/lib/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"
import { pusherServer } from "@/lib/pusher";

type SendMessagProps = {
    content: string,
    receiverId: string,
    type: "text" | "image"
}
export async function sendMessageAction({content,receiverId,type}:SendMessagProps){
    const { getUser } = getKindeServerSession();
    const currentUser = await getUser();

    if(!currentUser) return {success:false,message:"User is not authenticated"}

    const senderId = currentUser.id;

    const conversationId = `conversation:${[senderId,receiverId].sort().join(":")}`
    const conversationExists = await redis.exists(conversationId);
    if(!conversationExists){
        await redis.hset(conversationId,{
            participant1: senderId,
            participant2: receiverId
        })

        await redis.sadd(`conversation:${senderId}`,conversationId);
        await redis.sadd(`conversation:${receiverId}`,conversationId);
    }

    const messageId = `message:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;
	const timestamp = Date.now();

	// Create the message hash
	await redis.hset(messageId, {
		senderId,
		content,
		timestamp,
		type,
	});

	await redis.zadd(`${conversationId}:messages`, { score: timestamp, member: JSON.stringify(messageId) });

    const channelName = `${senderId}__${receiverId}`.split("__").sort().join("__");

	await pusherServer?.trigger(channelName, "newMessage", {
		message: { senderId, content, timestamp, type },
	});

    return { success: true, conversationId, messageId };
}

export async function getMessages(selectedUserId: string, currentUserId: string){
    const conversationId = `conversation:${[selectedUserId, currentUserId].sort().join(":")}`;
	const messageIds = await redis.zrange(`${conversationId}:messages`, 0, -1);

    if (messageIds.length === 0) return [];
    const pipeline = redis.pipeline();
	messageIds.forEach((messageId) => pipeline.hgetall(messageId as string));
	const messages = (await pipeline.exec()) as Message[];

	return messages;

}
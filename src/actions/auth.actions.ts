"use server"
import { redis } from "@/lib/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"

 //we make sure about this page rendering server side

export async function handleAuth() {
    const { getUser } = getKindeServerSession();
    const user = await getUser(); //session user
    
    if(!user) return {success:false}

    //user is namespace-important in redis
    const userId = `user:${user.id}`;

    const userExists = await redis.hgetall(userId);
    if (!userExists || Object.keys(userExists).length === 0) {
		const imgIsNull = user.picture?.includes("gravatar");
		const image = imgIsNull ? "" : user.picture;

		await redis.hset(userId, {
			id: user.id,
			email: user.email,
			name: `${user.given_name} ${user.family_name}`,
			image: image,
		});
	}

    return {success:true}

}
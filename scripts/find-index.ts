
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targets = process.argv.slice(2);
    if (targets.length === 0) {
        console.error('Usage: npx ts-node scripts/find-index.ts <ADDRESS_1> <ADDRESS_2> ...');
        process.exit(1);
    }

    console.log(`Checking ${targets.length} addresses...`);

    for (const addr of targets) {
        try {
            const s = await prisma.depositSession.findFirst({
                where: { depositAddress: { equals: addr, mode: 'insensitive' } }
            });

            if (s) {
                console.log(`\n✅ Address Found: ${addr}`);
                console.log(`- Index: ${s.derivationIndex}`);
                console.log(`- Chain: ${s.chain}`);
                console.log(`👉 Sweep Command: npx ts-node scripts/sweep-evm.ts ${s.chain} ${s.derivationIndex}`);
            } else {
                console.error(`\n❌ Address Not Found in DB: ${addr}`);
            }
        } catch (e) {
            console.error(`\n❌ Error searching for ${addr}: ${(e as Error).message}`);
        }
    }

    await prisma.$disconnect();
}

main();

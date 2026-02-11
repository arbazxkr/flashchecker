
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching recent BSC sessions...');
    const sessions = await prisma.depositSession.findMany({
        where: { chain: 'BSC' },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    for (const s of sessions) {
        console.log(`\nSession ID: ${s.id}`);
        console.log(`- Created: ${s.createdAt}`);
        console.log(`- Address: ${s.depositAddress}`);
        console.log(`- Index: ${s.derivationIndex}`);
        console.log(`- Status: ${s.status}`);
        console.log(`- TxHash: ${s.txHash || 'None'}`);
    }

    await prisma.$disconnect();
}

main();

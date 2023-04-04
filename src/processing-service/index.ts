import express from 'express';

const app = express();
app.use(express.json());

app.post('/orders', async (req, res) => {
    const messageId = req.body.id ?? "unknown";
    console.log(`*** ${messageId} Order received (timestamp: ${new Date().toISOString()})`, req.body);
    await sleep(200);
    console.log(`*** ${messageId} Order processed`);
    res.sendStatus(200);
});

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
app.listen(5002);
import { NextResponse } from 'next/server';
import { firestore } from '@/genkit/chatFlow';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Hardcoded matching the test scope in page.tsx
    const userId = searchParams.get('userId') || 'my-test-user-123';

    const snapshot = await firestore.collection('User_Chats').get();
    
    // Sort documents chronologically by native Firestore creation time
    // If the creation time is identical (from batch indexing), enforce USER prefix before AI
    const docs = snapshot.docs.sort((a, b) => {
       const timeA = a.createTime.toMillis();
       const timeB = b.createTime.toMillis();
       if (timeA === timeB) {
         const dataA = a.data();
         const dataB = b.data();
         const textA = dataA.content?.[0]?.[0]?.text || dataA.content?.[0]?.text || dataA.text || '';
         const textB = dataB.content?.[0]?.[0]?.text || dataB.content?.[0]?.text || dataB.text || '';
         if (typeof textA === 'string' && typeof textB === 'string') {
            if (textA.startsWith('USER:') && textB.startsWith('AI:')) return -1;
            if (textA.startsWith('AI:') && textB.startsWith('USER:')) return 1;
         }
       }
       return timeA - timeB;
    });

    const messages: { role: string; text: string }[] = [];
    const statsAccumulator = { originalBytes: 0, compressedBytes: 0, bytesSaved: 0 };
    
    docs.forEach(doc => {
      const data = doc.data();
      const stats = data.metadata?.turboQuantStats;

      if (stats) {
         statsAccumulator.originalBytes += stats.originalBytes || 0;
         statsAccumulator.compressedBytes += stats.compressedBytes || 0;
         statsAccumulator.bytesSaved += stats.bytesSaved || 0;
      }

      // Genkit Document usually wraps text natively in `content[0].text` or just `content`.
      // We gracefully check multiple typical Genkit properties.
      const rawText = data.content?.[0]?.[0]?.text || data.content?.[0]?.text || data.text || '';
      
      if (typeof rawText === 'string') {
         if (rawText.startsWith('USER: ')) {
           messages.push({ role: 'user', text: rawText.replace('USER: ', '').trim() });
         } else if (rawText.startsWith('AI: ')) {
           messages.push({ role: 'ai', text: rawText.replace('AI: ', '').trim() });
         }
      }
    });

    return NextResponse.json({ messages, stats: statsAccumulator });
  } catch (error) {
    console.error('Error fetching chat history from Firestore:', error);
    return NextResponse.json({ messages: [], stats: null }, { status: 500 });
  }
}

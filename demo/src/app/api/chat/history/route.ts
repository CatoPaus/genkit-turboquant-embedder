import { NextResponse } from 'next/server';
import { firestore } from '@/genkit/chatFlow';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Hardcoded matching the test scope in page.tsx
    const userId = searchParams.get('userId') || 'my-test-user-123';

    const snapshot = await firestore.collection('User_Chats').get();
    
    // Sort documents chronologically by native Firestore creation time
    const docs = snapshot.docs.sort((a, b) => {
       const timeA = a.createTime.toMillis();
       const timeB = b.createTime.toMillis();
       return timeA - timeB;
    });

    const messages: { role: string; text: string }[] = [];
    
    docs.forEach(doc => {
      const data = doc.data();
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

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching chat history from Firestore:', error);
    return NextResponse.json({ messages: [] }, { status: 500 });
  }
}

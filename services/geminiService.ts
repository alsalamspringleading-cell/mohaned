
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getInventoryAdvice = async (items: InventoryItem[]): Promise<string> => {
  const prompt = `
    أنت مساعد ذكي لإدارة المخزون الرياضي. إليك قائمة المخزون الحالي:
    ${JSON.stringify(items)}

    بناءً على هذه البيانات:
    1. حدد القطع التي تحتاج لإعادة طلب فورية (أقل من 3 قطع).
    2. قدم نصيحة حول توازن الفئات (ملابس، أحذية، معدات).
    3. اقترح استراتيجية بسيطة لتحسين المبيعات أو الطلب.
    تحدث باللغة العربية بأسلوب احترافي وودود.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "عذراً، لم أستطع تحليل البيانات حالياً.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "حدث خطأ أثناء محاولة الاتصال بالذكاء الاصطناعي.";
  }
};

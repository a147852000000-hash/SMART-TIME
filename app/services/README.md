# SMART TIME Services

## دور الصفحة

صفحة `app/services/page.tsx` هي صفحة الدعاية/التعريف بخدمة SMART TIME. تعرض فكرة البرنامج ومكوناته وأرقام مجموعة التدريب، وتوجّه المستخدم إلى تجربة خدمة الـ AI من خلال `/services/smart-ai`.

## تجربة الخدمة

من صفحة `/services/smart-ai` يقدر المستخدم يكتب طلبًا بالعربي/المصري مثل:

> سجلي 100 جنيه منظفات

الخدمة ترسل النص إلى `POST /api/ai/infer`، وتعرض الناتج المنظم بصيغة JSON وحالة الـ schema validation. لا يتم عرض نجاح تنفيذ وهمي؛ أدوات التعديل لا تُنفّذ بدون التأكيد المطلوب، وأي executor غير متوفر يرجع حالة واضحة.

## المسار الكامل

```
Qwen3-4B V2 (LoRA r=64, alpha=128)
        ↓
JSON-Only Generation
        ↓
Validation
        ↓
Retry عند فشل الـ validation
        ↓
Tool Router
        ↓
DB / Tool Execution
```

- **Qwen**: يفهم الطلب العربي ويولّد الاستجابة المنظمة.
- **JSON**: الناتج يجب أن يلتزم بالعقد المنظم.
- **Validation**: يتم رفض الناتج غير الصالح قبل تمريره للأدوات.
- **Retry**: عند فشل التحقق، مسار الـ inference يعيد المحاولة/يرجع حالة قابلة لإعادة المحاولة بدل تمرير JSON غير صالح.
- **Tool Router**: يختار الـ executor المناسب بعد اجتياز التحقق وقواعد التأكيد.
- **DB**: التنفيذ الفعلي يتم فقط عبر executor موجود ومؤكد؛ لا يتم ادعاء نجاح إذا لم يوجد backend executor.

## Dataset — 746 مثال

إجمالي dataset هو **746 مثالًا** بالتقسيمة التالية:

| الفئة | العدد |
|---|---:|
| Finance | 300 |
| Reminder | 150 |
| Calendar | 150 |
| Queries | 100 |
| Unsupported | 32 |
| Clarification | 14 |
| **الإجمالي** | **746** |

## Model Adapter

المسار المتوقع للـ V2 adapter:

`backend/ai/models/smart-ai-v2-super`

الـ adapter نفسه يتم توفيره من Kaggle في ملف:

`smart-ai-v2-super.zip`

الـ repository يحتوي على placeholder README داخل المجلد إلى أن يتم إدخال ملفات الـ adapter الفعلية.

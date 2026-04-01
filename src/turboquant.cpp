#include <napi.h>

Napi::Value CompressToPolarQuant(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Number array expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array inputArray = info[0].As<Napi::Array>();
    uint32_t length = inputArray.Length();
    
    // We create a standard JavaScript object array to return the mapped bits back to Genkit.
    // In a production hardware environment, this would be an Int8Array or packed string
    // but Genkit natively expects number[] for EmbedResponse, so we map back to Numbers.
    Napi::Array outputArray = Napi::Array::New(env, length);

    for (uint32_t i = 0; i < length; i++) {
        Napi::Value val = inputArray[i];
        if (val.IsNumber()) {
            double num = val.As<Napi::Number>().DoubleValue();
            
            // PolarQuant 1-bit native binarization: 
            // Evaluates sign bit directly in hardware
            int bit = (num > 0.0) ? 1 : 0;
            
            outputArray[i] = Napi::Number::New(env, bit);
        } else {
            outputArray[i] = Napi::Number::New(env, 0);
        }
    }

    return outputArray;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "compressToPolarQuant"), Napi::Function::New(env, CompressToPolarQuant));
    return exports;
}

NODE_API_MODULE(turboquant, Init)

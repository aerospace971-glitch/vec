import { create } from "zustand";

const useCompilerStore=create((set, get)=>({

        source:`#include <iostream>
        using namespace std;

        int main() {
            cout << "Hello, World!" << endl;
            return 0;
        }`,

        result:null,
        errors:[],
        compiled:false,
        setSource:(source)=>set(() => {
        if (source === get().source) return { source };
        return {
            source,
            result:null,
            errors:[],
            compiled:false,
        };
        }),
        setResult:(result)=>set({result}),
        setErrors:(errors)=>set({errors}),
        setCompiled:(compiled)=>set({compiled}),
        resetCompiler:()=>set({
        result:null,
        errors:[],
        compiled:false,
    }),

}));

export default useCompilerStore;

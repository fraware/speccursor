import Lake
open Lake DSL

package «speccursor-lean-engine» {
  -- add package configuration options here
}

@[default_target]
lean_lib SpeccursorLeanEngine {
  -- add library configuration options here
}

-- Mathlib4 dependency
require mathlib from git "https://github.com/leanprover-community/mathlib4.git" @ "v4.7.0-rc1"

-- Additional dependencies for formal verification
require aesop from git "https://github.com/JLimperg/aesop" @ "v4.8.0"
require std from git "https://github.com/leanprover/std4" @ "main"

@[default_target]
lean_exe «speccursor-lean-engine» {
  root := `Main
}

-- Test configuration
lean_exe «test» {
  root := `Test
}

-- Documentation
lean_exe «docs» {
  root := `Docs
}

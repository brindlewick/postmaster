---
url: https://www.cs.tufts.edu/~nr/cs257/archive/john-hughes/quick.pdf
retrieved: 2026-10-04
title: QuickCheck: A Lightweight Tool for Random Testing of Haskell Programs
author: Claessen and Hughes
---
Captured for #300's research on functional programming, formal verification and AI coding: The paper introduces QuickCheck, where a Haskell programmer writes properties as functions and the tool tests them on random inputs, and it argues that pure functions are much easier to test than side-effecting ones ("in Haskell, only computations in the IO monad are hard to test"), so random testing can be done at a fine grain.

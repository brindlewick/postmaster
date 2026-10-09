---
url: https://arxiv.org/abs/2412.06176
retrieved: 2026-10-04
title: AlphaVerus: Bootstrapping Formally Verified Code Generation through Self-Improving Translation and Treefinement
author: Aggarwal, Parno, Welleck
---
Captured for #300's research on functional programming, formal verification and AI coding: A model translating Dafny programs to Verus learned, without being told to, to write `assume(false)` and trivial specifications that the verifier accepted, so the authors added three filters; without the filters the model translated a large fraction of programs mainly by writing `assume(false)`, and the hacking snowballed over the iterations.

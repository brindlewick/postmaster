---
url: https://lamport.azurewebsites.net/tla/formal-methods-amazon.pdf
retrieved: 2026-10-04
title: Use of Formal Methods at Amazon Web Services (report dated 29 Sept 2014; the CACM 2015 article is titled "How Amazon Web Services Uses Formal Methods")
author: Newcombe, Rath, Zhang, Munteanu, Brooker, Deardeuff
---
Captured for #300's research on functional programming, formal verification and AI coding: Amazon engineers learned TLA+ in two to three weeks and wrote design-level specifications of 102 to 939 lines that, in the authors' account, "added significant value" in all 10 systems (bugs found in four of the five components in their table; the fifth, a lock-free structure, got "improved confidence" and missed a liveness bug the spec did not state), while the authors state that nothing checks that the code implements the verified design.

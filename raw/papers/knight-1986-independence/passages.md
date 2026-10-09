# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> In this paper an experiment is described in which the fundamental axiom is tested. A total of twenty seven versions of a program were prepared independently from the same specification at two universities and then subjected to one million tests.

Abstract; not checked (one fetch)

> The results of the tests revealed that the programs were individually extremely reliable but that the number of tests in which more than one program failed was substantially more than expected.

Abstract; not checked (one fetch)

> The conclusion from this experiment is that N-version programming must be used with care and that analysis of its reliability must include the effect of dependent errors.

Abstract; not checked (one fetch)

> Because the independence assumption is widely accepted and because of the potential importance of the issue in terms of safety, we have carried out a large scale experiment in N-version programming to study this assumption.

Introduction; not checked (one fetch)

> In graduate and senior level classes in computer science at the University of Virginia (UVA) and the University of California at Irvine (UCI), students were asked to write programs from a single requirements specification.

Description of Experiment; checked (two fetches)

> The result was a total of twenty seven programs (nine from UVA and eighteen from UCI)

Description of Experiment (fragment); not checked (one fetch gave the parenthesis, another cut the sentence before it)

> The need for independent development was stressed and students were carefully instructed not to discuss the project amongst themselves.

Description of Experiment; not checked (one fetch)

> The acceptance test was a set of two hundred randomly-generated test cases

Description of Experiment (fragment); not checked (one fetch)

> A test driver was built which generated random radar reflections and random values for all the parameters in the problem.

Description of Experiment; not checked (one fetch)

> Of the twenty seven, no failures were recorded by six versions and the remainder were successful on more than 99% of the tests.

Experimental Results; checked (two fetches)

> Table 2 shows the number of test cases in which more than one version failed on the same input.

Experimental Results; checked (two fetches)

Table 2 as rendered by the fetch tool (not a sentence quote). Number of versions failing on the same input and number of test cases: 2 versions, 551; 3, 343; 4, 242; 5, 73; 6, 32; 7, 12; 8, 2. The counts sum to 1,255.

Table 2; not checked as rendered (one fetch); the sum matches the K value in the passage below.

Table 1 as rendered by the fetch tool (not a sentence quote). Failures out of 1,000,000 for each of the 27 versions, in the order given: 2, 0, 2297, 0, 0, 1149, 71, 323, 53, 0, 554, 427, 4, 1368, 0, 62, 269, 115, 264, 936, 92, 9656, 80, 260, 97, 883, 0.

Table 1; not checked (one fetch); the six zeros agree with the six failure-free versions in the passage above.

> one million tests were executed (i.e. n = 1,000,000), and the number of tests in which more than one version failed was 1255 (i.e. K = 1255).

Model of Independence; not checked as a quote (one fetch); K agrees with the sum of the Table 2 counts.

> With these parameters, the statistic z has the value 100.51.

Model of Independence; checked (two fetches)

> This is greater than 2.33 which is the 99% point in the standard normal distribution, and so we reject the null hypothesis with a confidence level of 99%.

Model of Independence; not checked (one fetch)

> A total of forty five faults were detected in the program versions used in this experiment.

Analysis of Faults; checked (two fetches)

> Based on a preliminary analysis of the faults in the programs, we have found that approximately one half of the total software faults found involved two or more programs.

Conclusions; checked (two fetches)

> For the particular problem that was programmed for this experiment, we conclude that the assumption of independence of errors that is fundamental to the analysis of N-version programming does not hold.

Conclusions; checked (two fetches)

> First, it is conditional on the application that we used. The result may or may not extend to other programs, we do not know.

Conclusions; checked (two fetches)

> A second point is that our result does not mean that N-version programming does not work or should never be used.

Conclusions; checked (two fetches)

> One is that certain parts of any problem are just more difficult than others and will lead to the same faults by different programmers.

Conclusions (one of the alternative explanations the authors list for the common faults); not checked (one fetch)

> We do not think this is the case in this experiment since great care went into its preparation and the requirements specification had been debugged through use in an earlier experiment.

Conclusions (on whether flaws in the specification explain the common faults); not checked (one fetch)

> relying on random chance to get diversity in programs and eliminate design faults may not be effective.

Conclusions (fragment); checked (two fetches)

Derived, not quotes. The sentence "With these parameters, the statistic z has the value 100.51" together with K = 1255 and the normal approximation z = (K - n*Pmore) / sqrt(n*Pmore*(1 - Pmore)) implies n*Pmore of about 126 expected test cases with more than one failing version under independence, against 1,255 observed (about tenfold). Working: solve (1255 - m) / sqrt(m) = 100.51, giving sqrt(m) = 11.23, m = 126. A second route, from the Table 1 counts as rendered, gives about 127 (sum over pairs of p_i * p_j). The paper text retrieved does not state the expected count itself.

# A pure counting proof of Frobenius' Theorem

>Let $$G$$ be a finite group, and $$n$$ be a positive integer dividing $$|G|$$. Then $$n$$ divides $$\# \{g \in G : g^n = 1\}$$.

This is a theorem about general finite groups due to Frobenius, and it is purely elementary, but is less well-known compared to [Sylow's Theorem](https://en.wikipedia.org/wiki/Sylow_theorems), despite the fact that there are some interesting applications of this theorem, see [Artin–Hasse exponential](https://en.wikipedia.org/wiki/Artin%E2%80%93Hasse_exponential).

I stumbled upon a proof through a counting argument by [David Speyer](https://websites.umich.edu/~speyer/), see his [post](https://sbseminar.wordpress.com/2015/09/05/a-counting-argument-for-frobenius-theorem/). At the end of the post he raised the question about whether we can avoid Möbius inversion in that argument and directly reach the key equation. In this blog we follow his thoughts and establish such an argument by double counting. We will reiterate his notations and restate some of the lemmas in his post.

Fix a finite group $$G$$ and a positive integer $$n$$ dividing $$|G|$$. For any $$d$$ dividing $$|G|$$, let $$N_d$$ be the number of $$d$$-torsion elements in $$G$$, and let $$M_d$$ denote the number of elements of order precisely $$d$$. So 
$$
N_d = \sum_{e | d} M_e
$$

>(Corollary of [Burnside's lemma](https://en.wikipedia.org/wiki/Burnside%27s_lemma))
>If a finite group $$G$$ acts on a finite set $$X$$, then $$\sum_{g \in G} \#\{x \in X: gx = x\} \equiv 0 \pmod{|G|}$$.

Now we construct a set and we will be counting its cardinality in two ways. 

Consider a necklace with $|G|$ beads, exactly $n$ of which are black, and $|G|-n$ of them are white. Moreover, we require the positions are labeled with $0, \cdots, |G| - 1$. Denote $W$ as the set of such necklaces.

The cyclic group of order $|G|$ naturally acts on $W$ by rotation. For each $w \in W$, let $s(w)$ be the number of rotations that preserves the color configuration, including the identity rotation. 

Consider the set $$ \mathcal{J} = \{(g,w) \in G \times W: g^{s(w)} = 1\} $$, we will be counting $$|\mathcal{J}|$$ in two ways.

Let $$\mathcal{N}(a, b)$$ denote the number of "primitive" necklaces of $a$ beads, with exactly $b$ black beads, where "primitive" is in the sense that the necklace has no nontrivial rotational symmetry. Here we distinguish necklaces by color configuration and labels, i.e., two same colored necklaces are different as long as one of them is a nontrivial rotation of the other. Observe that $a | \mathcal{N}(a, b)$ since for each such necklace has exactly $a$ distinct rotations because we assumed the nonexistence of nontrivial rotational symmetry. 

First we fix $w \in W$. Suppose $s(w) = e$, observe that $e$ divides $n$. Indeed, the subgroup of rotations preserving $w$ acts freely on $|G|$ bead positions, and its orbits all have size $s(w)$, and the set of black beads is a disjoint union of these orbits. 

Moreover, $s(w) = e$ means that the necklace can be viewed as a disjoint union of $e$ identical copies of a primitive necklace with $|G|/e$ beads of which $n/e$ of them are black. Conversely, repeating any primitive necklace of $|G|/e$ beads exactly $e$ times gives a necklace $w$ with $s(w) = e$. Thus, there are exactly $\mathcal{N}(|G|/e, n/e)$ choices of $w$ with $s(w)=e$.

Summing over all possible divisors $e \vert n$, we obtain
$$
|\mathcal{J}| = \sum_{e | n} N_e\mathcal{N}(|G|/e, n/e)
$$
On the other hand, we fix $g \in G$, and suppose $\text{ord}(g) = d$. 
The condition $g^{s(w)} = 1$ is equivalent to $d | s(w)$, which is equivalent of saying that $w$ is preserved by rotating $|G| / d$ positions. 

Now we consider the permutation of $G$ by left multiplication by $g$. Since $g$ has order $d$, the permutation is a disjoint union of $|G|/d$ cycles, each of length $d$. Moreover, rotation through $|G|/d$ positions on the necklace of $|G|$ beads has the same cycle decomposition of $|G|/d$ cycles each of length $d$. 

Now we claim that this induces a bijection between the necklaces $w \in W$ satisfying $g^{s(w)} = 1$ and the subsets of $G$ that contains $n$ elements which is fixed by $g$ under left multiplication.

Explicitly, we choose representatives $x_0, \cdots, x_{|G|/d - 1}$ for the orbits of $g$ acting on $G$. We identify the group element $g^jx_i$ with hte bead at position $i + j \frac{|G|}{d}$ with indices modulo $|G|$. Under this correspondence, multiplication by $g$ becomes rotating through $|G|/d$ bead positions. Denote $X$ as the subsets of $G$ which contains $n$ elements, then choosing $n$ black beads one-to-one corresponds to choosing an $n$-element subset of $G$, and two configurations are preserved by their respective action by $g$. Hence 
$$
\#\{w \in W: (g,w) \in \mathcal{J}\} = \#\{A \in X: gA = A\}
$$
Summing over $g \in G$, we obtain 
$$
|\mathcal{J}| = \sum_{g \in G}\#\{A \in X: gA = A\}
$$
Combine the two identities, and using the aformentioned Corollary of Burnside's theorem, we have 
$$
\sum_{e|n} N_e \ \mathcal{N}(|G|/e, n/e) \equiv 0 \pmod{|G|}
$$
Now we follow a similar approach as in Speyer's post to deduce $N_n \equiv 0 \pmod{n}$ by inducting on $n$. 

Base case $n=1$ is immediate. Suppose for any proper divisor $e|n$ we have $e|N_e$. From our previous observation with $\mathcal{N}(a,b)$ we have that $|G|/e$ divides $\mathcal{N}(|G|/e, n/e)$. Combine this with $e|N_e$, we have $|G|$ divides every single term in the sum possibly except for the last one where $e=n$, but with the total sum being divisible by $|G|$, we can deduce that $N_n\mathcal{N}({|G|/n}, 1)$ is divisible by $|G|$. Note that we have  $\mathcal{N}({|G|/n}, 1) = |G|/n$, since we have 1 black bead, with $|G|/n$ distinguished positions to place the black bead. In other words, $N_n \cdot  |G|/n \equiv 0 \pmod{|G|}$, hence $N_n \equiv 0 \pmod{n}$ and we are done.





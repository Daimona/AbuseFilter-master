a := [1, 2, 3];
b := [1, 2, 3];
c := [2, 3, 4];
d := [1, 2, 3, 4];
e := ['1', '2', '3'];
f := [[['1']]];
g := [[[1]]];
h := [[1, 2], 3];
i := [['1', 2], '3'];
j := [1];
k := ['1'];
l := [];

a == b & a === b & a != c & b != d & a == e & a !== e & f == g & f !== g & h == i & h !== i & e != i & j != 1 &
k != '1' & l == false & l == null & l !== false & l !== null & false == l & null == l & false !== l & null !== l

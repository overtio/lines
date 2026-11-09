# Bookshelf for the hall

Oak boards from the yard on Via Roma, 2 cm thick, oiled rather than varnished.

```mermaid
flowchart LR
  measure[Measure the wall] --> cut[Cut the boards]
  cut --> oil[Sand and oil]
  oil --> build[Put it together]
  build --> books[Fill it with books]
```

```openscad
// Three shelves, 80 cm wide and 25 cm deep
for (z = [0, 34, 68]) translate([0, 0, z]) cube([80, 25, 2]);
for (x = [0, 78]) translate([x, 0, 0]) cube([2, 25, 70]);
```

#home

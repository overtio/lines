# Code notes
# #tour
#
# Switch any note to Code in its ⓘ panel, and choose its language: it's drawn
# as code, with line numbers, in a fixed-width font, and highlighted in your
# theme's colors. Tab indents, brackets close themselves, and the note stays
# exactly the file you'd save: this one downloads as a .py file.


def fizzbuzz(n: int) -> str:
    """Fizz for multiples of three, Buzz for five, and FizzBuzz for both."""
    if n % 15 == 0:
        return "FizzBuzz"
    if n % 3 == 0:
        return "Fizz"
    if n % 5 == 0:
        return "Buzz"
    return str(n)


for n in range(1, 16):
    print(fizzbuzz(n))

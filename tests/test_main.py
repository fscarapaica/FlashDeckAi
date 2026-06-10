import os
import sys
import unittest

# Ensure the main.py can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import main


class TestMain(unittest.TestCase):
    def test_main(self) -> None:
        """A simple test just to verify things run."""
        self.assertTrue(True)


if __name__ == '__main__':
    unittest.main()

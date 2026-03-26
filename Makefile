CXX := g++
CXXFLAGS := -std=c++20 -O2 -Wall -Wextra -pedantic
CPP_SRC := cpp/deck_guard.cpp
CPP_OUT := build/deck_guard

.PHONY: cpp clean

cpp: $(CPP_OUT)

$(CPP_OUT): $(CPP_SRC)
	mkdir -p build
	$(CXX) $(CXXFLAGS) $(CPP_SRC) -o $(CPP_OUT)

clean:
	rm -f $(CPP_OUT)

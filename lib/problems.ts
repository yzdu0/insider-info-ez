export type Language = "python" | "cpp" | "pseudocode";

export const categories = ["Algorithms", "OOP", "Systems programming", "Distributed systems"] as const;
export type ProblemCategory = (typeof categories)[number];

export type Problem = {
  id: string;
  title: string;
  description: string;
  category: ProblemCategory;
  difficulty: "Easy" | "Medium" | "Hard" | "Expert";
  preferredLanguage: Language;
  starters: Partial<Record<Language, string>>;
};

// Candidate-visible information only. Requirements belong in problem-details.ts.
export const problems: readonly Problem[] = [
  {
    "id": "bank-account",
    "title": "Bank account",
    "category": "OOP",
    "difficulty": "Easy",
    "description": "Model a bank account that protects its balance while accepting deposits and withdrawals.",
    "preferredLanguage": "cpp",
    "starters": {
      "cpp": "class BankAccount {\npublic:\n    // Define the interface and implementation.\n};\n",
      "python": "class BankAccount:\n    pass\n",
      "pseudocode": ""
    }
  },
  {
    "id": "shopping-cart",
    "title": "Shopping cart",
    "category": "OOP",
    "difficulty": "Medium",
    "description": "Design a shopping cart that manages products, quantities, and pricing.",
    "preferredLanguage": "cpp",
    "starters": {
      "cpp": "class ShoppingCart {\npublic:\n    // Define the interface and implementation.\n};\n",
      "python": "class ShoppingCart:\n    pass\n",
      "pseudocode": ""
    }
  },
  {
    "id": "notification-service",
    "title": "Notification service",
    "category": "OOP",
    "difficulty": "Medium",
    "description": "Design a service that delivers notifications through interchangeable channels.",
    "preferredLanguage": "cpp",
    "starters": {
      "cpp": "class NotificationService {\npublic:\n    // Define the interface and implementation.\n};\n",
      "python": "class NotificationService:\n    pass\n",
      "pseudocode": ""
    }
  },
  {
    "id": "library-loans",
    "title": "Library lending",
    "category": "OOP",
    "difficulty": "Medium",
    "description": "Model a library that lends copies of books to members and accepts returns.",
    "preferredLanguage": "cpp",
    "starters": {
      "cpp": "class Library {\npublic:\n    // Define the interface and implementation.\n};\n",
      "python": "class Library:\n    pass\n",
      "pseudocode": ""
    }
  },
  {
    "id": "vending-machine",
    "title": "Vending machine",
    "category": "OOP",
    "difficulty": "Hard",
    "description": "Design a vending machine that handles payment, dispensing, and cancellation.",
    "preferredLanguage": "cpp",
    "starters": {
      "cpp": "class VendingMachine {\npublic:\n    // Define the interface and implementation.\n};\n",
      "python": "class VendingMachine:\n    pass\n",
      "pseudocode": ""
    }
  },
  {
    "id": "drawing-editor",
    "title": "Drawing editor",
    "category": "OOP",
    "difficulty": "Hard",
    "description": "Design a drawing editor with different shapes and undoable actions.",
    "preferredLanguage": "cpp",
    "starters": {
      "cpp": "class DrawingEditor {\npublic:\n    // Define the interface and implementation.\n};\n",
      "python": "class DrawingEditor:\n    pass\n",
      "pseudocode": ""
    }
  },

  {
    id: "two-sum",
    category: "Algorithms", difficulty: "Easy",
    title: "Two sum",
    description: "Given an array of elements and a target, we want to determine if there exists a pair of elements that add to target.",
    preferredLanguage: "python",
    starters: { cpp: "#include <vector>\n\nbool two_sum(const std::vector<int>& elements, int target) {\n    // Your implementation\n}\n", python: "def two_sum(elements, target):\n    pass\n", pseudocode: "" },
  },
  {
    id: "valid-parentheses",
    category: "Algorithms", difficulty: "Easy",
    title: "Valid parentheses",
    description: "Given a string of brackets, determine whether it is valid.",
    preferredLanguage: "python",
    starters: { cpp: "#include <string>\n\nbool is_valid(const std::string& s) {\n    // Your implementation\n}\n", python: "def is_valid(s):\n    pass\n", pseudocode: "" },
  },
  {
    id: "longest-substring",
    category: "Algorithms", difficulty: "Medium",
    title: "Longest unique substring",
    description: "Given a string, find its longest substring without repeated characters.",
    preferredLanguage: "python",
    starters: { cpp: "#include <string>\n\nint longest_unique_substring(const std::string& s) {\n    // Your implementation\n}\n", python: "def longest_unique_substring(s):\n    pass\n", pseudocode: "" },
  },
  {
    id: "owned-buffer",
    category: "Systems programming", difficulty: "Hard",
    title: "Owned buffer",
    description: "Review this buffer class and make it safe to use.",
    preferredLanguage: "cpp",
    starters: {
      cpp: `#include <cstddef>
#include <algorithm>

class Buffer {
    std::size_t size_;
    int* data_;

public:
    explicit Buffer(std::size_t size)
        : size_(size), data_(new int[size]{}) {}

    ~Buffer() { delete data_; }

    Buffer(const Buffer& other)
        : size_(other.size_), data_(other.data_) {}

    Buffer& operator=(const Buffer& other) {
        delete[] data_;
        size_ = other.size_;
        data_ = other.data_;
        return *this;
    }

    int& operator[](std::size_t index) { return data_[index]; }
    std::size_t size() const { return size_; }
};
`,
      pseudocode: "",
    },
  },
  {
    id: "erase-nodes",
    category: "Systems programming", difficulty: "Medium",
    title: "Erase nodes",
    description: "Review this linked-list function and make it safe to use.",
    preferredLanguage: "cpp",
    starters: {
      cpp: `struct Node {
    int value;
    Node* next;
};

Node* erase_value(Node* head, int value) {
    Node* previous = nullptr;
    Node* current = head;

    while (current) {
        if (current->value == value) {
            if (previous) previous->next = current->next;
            delete current;
        }
        previous = current;
        current = current->next;
    }
    return head;
}
`,
      pseudocode: "",
    },
  },
  {
    id: "order-book", title: "OrderBook", category: "Systems programming", difficulty: "Expert",
    description: "Design an OrderBook class that accepts, matches, and cancels orders.",
    preferredLanguage: "cpp",
    starters: { cpp: "class OrderBook {\npublic:\n    // Define the interface and implementation.\n};\n", pseudocode: "" },
  },
  {
    id: "bounded-queue", title: "Bounded concurrent queue", category: "Systems programming", difficulty: "Hard",
    description: "Build a bounded queue that can be used by multiple threads.",
    preferredLanguage: "cpp",
    starters: { cpp: "template <typename T>\nclass BoundedQueue {\npublic:\n    // Define the interface and implementation.\n};\n", pseudocode: "" },
  },
  {
    id: "replicated-kv", title: "Replicated key-value store", category: "Distributed systems", difficulty: "Expert",
    description: "Design a key-value store that continues working when a server fails.",
    preferredLanguage: "pseudocode",
    starters: { python: "class ReplicatedStore:\n    pass\n", pseudocode: "" },
  },
  {
    id: "distributed-jobs", title: "Distributed job queue", category: "Distributed systems", difficulty: "Hard",
    description: "Design a job queue that supports multiple workers and retries failed work.",
    preferredLanguage: "pseudocode",
    starters: { python: "class JobQueue:\n    pass\n", pseudocode: "" },
  },
  {
    id: "distributed-rate-limiter", title: "Distributed rate limiter", category: "Distributed systems", difficulty: "Hard",
    description: "Design a rate limiter shared by several application servers.",
    preferredLanguage: "pseudocode",
    starters: { python: "class RateLimiter:\n    pass\n", pseudocode: "" },
  },
  {
    id: "sharded-rebalance", title: "Online shard migration", category: "Distributed systems", difficulty: "Expert",
    description: "Design a way to move data between shards while serving reads and writes.",
    preferredLanguage: "pseudocode",
    starters: { python: "class ShardMigration:\n    pass\n", pseudocode: "" },
  },
  {
    id: "merge-intervals", title: "Merge overlapping intervals", category: "Algorithms", difficulty: "Medium",
    description: "Implement a C++ function that combines overlapping intervals.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <vector>\n\nstruct Interval {\n    int start;\n    int end;\n};\n\nstd::vector<Interval> merge_intervals(const std::vector<Interval>& intervals) {\n    // Your implementation\n}\n" },
  },
  {
    id: "dynamic-connectivity", title: "Dynamic connectivity", category: "Algorithms", difficulty: "Medium",
    description: "Implement a C++ class that tracks which nodes are connected as edges are added.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstddef>\n#include <vector>\n\nclass Connectivity {\npublic:\n    // Define the interface and implementation.\n};\n" },
  },
  {
    id: "shortest-path", title: "Weighted shortest path", category: "Algorithms", difficulty: "Hard",
    description: "Implement a C++ function that finds the cheapest route through a weighted graph.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstdint>\n#include <optional>\n#include <vector>\n\nstruct Edge {\n    int to;\n    std::int64_t weight;\n};\n\nstruct Route {\n    std::int64_t cost;\n    std::vector<int> nodes;\n};\n\nstd::optional<Route> shortest_path(\n    const std::vector<std::vector<Edge>>& graph, int source, int target) {\n    // Your implementation\n}\n" },
  },
  {
    id: "lru-cache", title: "LRU cache", category: "Systems programming", difficulty: "Medium",
    description: "Design and implement a C++ cache that evicts its least recently used entry when full.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstddef>\n#include <optional>\n#include <string>\n\nclass LruCache {\npublic:\n    // Define the interface and implementation.\n};\n" },
  },
  {
    id: "leased-task-queue", title: "Leased task queue", category: "Systems programming", difficulty: "Hard",
    description: "Design and implement a C++ task queue that can recover work abandoned by a worker.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstdint>\n#include <optional>\n#include <string>\n\nclass TaskQueue {\npublic:\n    // Define the interface and implementation.\n};\n" },
  },
  {
    id: "consistent-hash-ring", title: "Consistent hash router", category: "Systems programming", difficulty: "Hard",
    description: "Design and implement a C++ router that assigns keys to servers as servers join and leave.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstdint>\n#include <optional>\n#include <string>\n\nclass HashRouter {\npublic:\n    // Define the interface and implementation.\n};\n" },
  },
  {
    id: "round-robin-scheduler", title: "Round-robin scheduler", category: "Systems programming", difficulty: "Medium",
    description: "Implement a C++ simulator that schedules CPU work fairly across arriving processes.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstdint>\n#include <vector>\n\nclass Scheduler {\npublic:\n    // Define the process model, interface, and implementation.\n};\n" },
  },
  {
    id: "page-replacement", title: "Page replacement", category: "Systems programming", difficulty: "Medium",
    description: "Implement a C++ simulator that decides which page to evict when physical memory is full.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstddef>\n#include <vector>\n\nclass PageCache {\npublic:\n    // Define the interface and implementation.\n};\n" },
  },
  {
    id: "arena-allocator", title: "Coalescing arena allocator", category: "Systems programming", difficulty: "Hard",
    description: "Implement a C++ allocator that manages and reuses blocks within a fixed-size arena.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstddef>\n#include <optional>\n#include <vector>\n\nclass ArenaAllocator {\npublic:\n    // Define the interface and implementation.\n};\n" },
  },
  {
    id: "expression-lexer", title: "Expression lexer", category: "Systems programming", difficulty: "Medium",
    description: "Implement a C++ lexer that turns a small expression language into tokens.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstddef>\n#include <string>\n#include <vector>\n\nclass Lexer {\npublic:\n    // Define the token model, interface, and implementation.\n};\n" },
  },
  {
    id: "expression-parser", title: "Expression parser", category: "Systems programming", difficulty: "Hard",
    description: "Implement a C++ parser that builds a syntax tree for arithmetic expressions.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <memory>\n#include <string>\n\nclass Parser {\npublic:\n    // Define the syntax tree, interface, and implementation.\n};\n" },
  },
  {
    id: "bytecode-vm", title: "Stack bytecode machine", category: "Systems programming", difficulty: "Hard",
    description: "Implement a C++ virtual machine that executes a small stack-based instruction set.",
    preferredLanguage: "cpp",
    starters: { cpp: "#include <cstdint>\n#include <vector>\n\nclass VirtualMachine {\npublic:\n    // Define the instruction model, interface, and implementation.\n};\n" },
  },
];

export function getProblem(id: string) {
  return problems.find((problem) => problem.id === id);
}

export function getOpeningMessage(problem: Problem) {
  return `Let’s begin.\n\n${problem.description}`;
}

export const difficultyRank = { Easy: 0, Medium: 1, Hard: 2, Expert: 3 };

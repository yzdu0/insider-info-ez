import "server-only";

// Interviewer-only contract. Reveal individual details when the candidate asks.
export const problemDetails: Record<string, {
  description: string;
  examples: { input: string; output: string }[];
  constraints: string[];
}> = {
  "bank-account": {
    "description": "Implement a BankAccount with deposit, withdraw, and a read-only balance. Protect balance invariants through the public interface.",
    "examples": [
      {
        "input": "start 100; withdraw 40; deposit 10",
        "output": "balance 70"
      },
      {
        "input": "balance 70; withdraw 80",
        "output": "Reject; balance stays 70"
      }
    ],
    "constraints": [
      "Amounts are integer cents; initial balance is nonnegative. Deposits and withdrawals require positive amounts. Reject invalid amounts without mutation.",
      "No overdrafts. Balance is private; callers cannot set it directly. Choose and explain a consistent error API.",
      "Use checked arithmetic (signed 64-bit in C++) to reject overflow before mutation. Single-threaded, no persistence or transfers.",
      "Ask for concrete methods and invariants; discuss why inheritance is unnecessary for a single account type."
    ]
  },
  "shopping-cart": {
    "description": "Implement a ShoppingCart composed of line items with product ID, unit price in integer cents, and quantity. Provide add, remove, set_quantity, and total.",
    "examples": [
      {
        "input": "add A at 250 x2; add A at 250 x1",
        "output": "One line, quantity 3; total 750"
      },
      {
        "input": "set_quantity(A,0)",
        "output": "Remove A; total 0"
      }
    ],
    "constraints": [
      "Prices are nonnegative integer cents; add quantities must be positive. Negative quantities are invalid.",
      "An existing product ID must retain its captured unit price; reject an add with a different price atomically. Prices do not change after adding.",
      "remove of a missing item returns false; set_quantity of a missing item reports an error. Zero quantity removes a line.",
      "Reject integer overflow in quantities, line totals, and cart total before mutation. No taxes, discounts, stock, checkout, or persistence.",
      "Own line-item state; external product changes and returned snapshots cannot mutate the cart. Use composition rather than inheriting from a container."
    ]
  },
  "notification-service": {
    "description": "Implement a NotificationService with injected email and SMS channels behind a common delivery interface. Return a per-channel delivery result for each requested channel.",
    "examples": [
      {
        "input": "send to email and SMS; email succeeds, SMS fails",
        "output": "Two results; email success and SMS failure"
      },
      {
        "input": "register a fake channel, then send through it",
        "output": "Fake receives the message; service orchestration is unchanged"
      }
    ],
    "constraints": [
      "Channels are selected by unique name. Reject duplicate registration and unknown channel requests before sending anything.",
      "The caller supplies channel-specific destination strings. Message and destination must be nonempty; validate the whole request before sending.",
      "Catch individual channel delivery failures and continue to the remaining requested channels; repeated channel names in one request are rejected.",
      "Inject fake channels for demonstration; do not call real providers. Synchronous, single-threaded; retry, persistence, and delivery guarantees are out of scope.",
      "Require a concrete polymorphic interface and implementation. In C++, ensure virtual destruction and explicit ownership; avoid a growing type switch in the service."
    ]
  },
  "library-loans": {
    "description": "Implement a Library model separating book titles, physical copies, members, and active loans. Provide checkout(copy_id,member_id) and return_copy(copy_id).",
    "examples": [
      {
        "input": "Copies C1 and C2 share a title; checkout(C1,M1); checkout(C2,M2)",
        "output": "Both loans succeed independently"
      },
      {
        "input": "checkout(C1,M2) while C1 is loaned",
        "output": "Reject without changing its current borrower"
      }
    ],
    "constraints": [
      "IDs are unique within their entity type. Only registered members and existing copies can be used.",
      "Each physical copy has at most one active loan; each member may have at most three active loans. Reject checkout when either invariant would break.",
      "Returning an unloaned or unknown copy reports an error. A return releases the copy and decrements the original borrower's loan count atomically.",
      "Separate title metadata from copy availability and loan relationships; do not duplicate title metadata for each loan.",
      "Single-threaded, in-memory; no reservations, fines, dates, or persistence. Provide concrete domain objects and operations, not only a class diagram."
    ]
  },
  "vending-machine": {
    "description": "Implement a VendingMachine with select(product_id), insert(amount), vend(), and cancel(). Model inventory, transaction state, credit, and an injected dispensing device.",
    "examples": [
      {
        "input": "A costs 150; select A; insert 200; vend succeeds",
        "output": "One A dispensed; change 50; machine returns to idle"
      },
      {
        "input": "Device fails after sufficient payment",
        "output": "No stock consumed; credit retained; candidate may retry or cancel"
      }
    ],
    "constraints": [
      "Prices and payments are positive integer cents with checked arithmetic. Inventory quantities are nonnegative.",
      "Selection must reference an in-stock product. Selecting while another selection is active is rejected; inserting money requires an active selection.",
      "vend requires selection and sufficient credit. Device reports success or failure unambiguously; only success decrements stock, clears credit, and returns change.",
      "cancel refunds all credit and clears selection, including after device failure. Cancel when idle returns zero.",
      "Assume unlimited change and single-threaded calls. No real hardware or persistence. Explain legal state transitions; use an enum or state objects with clear responsibilities."
    ]
  },
  "drawing-editor": {
    "description": "Implement a DrawingEditor with rectangle and circle shapes, add/remove/move operations, and undo of the last successful edit. Represent edits as commands and shapes behind a common interface.",
    "examples": [
      {
        "input": "add circle C at (0,0); move C to (3,4); undo",
        "output": "C returns to (0,0); a second undo removes C"
      },
      {
        "input": "remove rectangle R; undo",
        "output": "Restore the same ID, dimensions, and position"
      }
    ],
    "constraints": [
      "Shape IDs are unique. Coordinates are bounded integers; radius, width, and height are positive. Reject invalid geometry and duplicate IDs without changing history.",
      "move uses an absolute target position. Missing IDs for move or remove are errors. Failed edits do not enter undo history.",
      "undo on empty history returns false. A successful undo removes its command from history; redo, grouping, rendering, and persistence are out of scope.",
      "Removed objects must stay owned by their undo command until restored or discarded. In C++, avoid slicing and dangling references; use virtual destruction.",
      "Adding a new shape should not require changing editor dispatch logic. Implement command execution and inverse behaviour; diagrams alone are insufficient."
    ]
  },
  "merge-intervals": {
    description: "Implement merge_intervals in C++17. Return the union of closed integer intervals as disjoint intervals sorted by start, without modifying the input.",
    examples: [{ input: "[(5,7), (1,3), (3,4), (9,9)]", output: "[(1,4), (5,7), (9,9)]" }, { input: "[(1,10), (2,3), (1,10)]", output: "[(1,10)]" }],
    constraints: [
      "Input may be unsorted, contain duplicates, and contain negative endpoints. Every interval satisfies start <= end; empty input returns an empty vector.",
      "Closed intervals sharing an endpoint overlap. Adjacent intervals such as [1,2] and [3,4] do not overlap; do not merge merely because endpoints differ by one.",
      "Endpoints fit a signed 32-bit int. Compare endpoints directly; avoid arithmetic such as end + 1 that can overflow.",
      "At most 100,000 intervals. Target O(n log n) time and O(n) extra storage, including output and the copy needed to preserve the input.",
      "Require actual C++ code and reasoning about nested intervals, equal starts, and the final output interval. No execution claims.",
    ],
  },
  "dynamic-connectivity": {
    description: "Implement a C++17 Connectivity class initialized with n isolated nodes, with unite(a,b), connected(a,b), and component_count(). Edges are added incrementally; no edges are deleted.",
    examples: [{ input: "n=5; unite(0,1); unite(1,2); connected(0,2); component_count()", output: "true; 3 components" }, { input: "unite(0,2) again; component_count()", output: "Still 3 components; the repeated union reports no change." }],
    constraints: [
      "Nodes are integers in [0,n); 0 <= n <= 1,000,000. Constructing an empty structure is valid. Invalid indices throw std::out_of_range before changing logical connectivity.",
      "unite returns true only when it joins two different components. Self-edges and repeated edges return false. connected is symmetric and each valid node is connected to itself.",
      "Use disjoint-set union with path compression and union by size or rank; target amortized near-constant time per operation and O(n) memory. Reveal algorithm requirements only when clarified.",
      "component_count starts at n and decreases once per successful union. A query must not add nodes or change the component count.",
      "Single-threaded and in-memory. Discuss representation invariants and stack depth; implement the operations in C++, not only a graph diagram.",
    ],
  },
  "shortest-path": {
    description: "Implement shortest_path in C++17 for a directed graph represented by adjacency lists. Return an optional Route containing the minimum cost and one corresponding node sequence from source to target.",
    examples: [{ input: "Edges 0->1(4), 0->2(1), 2->1(2), 1->3(1), 2->3(5); source=0, target=3", output: "cost=4, nodes=[0,2,1,3]" }, { input: "Two nodes, no edges; source=0, target=1", output: "nullopt" }, { input: "source=target=0 in a one-node graph", output: "cost=0, nodes=[0]" }],
    constraints: [
      "Graph has 1 to 100,000 nodes and at most 200,000 edges. Node indices and endpoints are valid; source and target are valid indices.",
      "Weights are integers in [0,1,000,000,000]. Zero-weight edges, parallel edges, self-loops, and cycles are allowed. Negative weights are out of scope.",
      "Cost uses std::int64_t. Avoid overflow when combining a distance sentinel with an edge weight. Do not mutate the graph.",
      "Unreachable targets return nullopt. For equal-cost routes, any valid minimum-cost route is accepted; no lexicographic tie-breaking is required.",
      "Use a priority-queue shortest-path algorithm with stale-entry handling; target O((V+E) log(V+E)) time and O(V+E) extra memory for this lazy-queue implementation.",
      "Reconstruct the actual route using predecessor information; a cost alone is incomplete. Guard against predecessor cycles when equal-distance alternatives exist.",
    ],
  },
  "lru-cache": {
    description: "Design and implement a single-threaded C++17 LruCache for string keys and string values. Provide get(key), put(key,value), and size() with a fixed maximum entry count.",
    examples: [{ input: "capacity=2; put(A,one); put(B,two); get(A); put(C,three); get(B)", output: "get(A) returns one and makes A most recent; C evicts B; get(B) returns nullopt." }, { input: "put(A,updated) when A is already cached", output: "A's value changes and A becomes most recent; size does not grow." }],
    constraints: [
      "get returns an optional string by value. Missing keys return nullopt and do not change recency; successful gets and all successful puts mark the entry most recently used.",
      "put on an existing key updates it without evicting another entry. put on a new key at capacity evicts exactly the least recently used entry.",
      "Capacity zero is valid: puts retain nothing, all gets miss, and size remains zero. Capacity is fixed after construction; TTL and byte-based limits are out of scope.",
      "Target expected O(1) get and put, apart from string copying and hashing costs, and O(capacity) entries. Explain lifetime and iterator stability between the recency structure and lookup index.",
      "Define a safe copy/move policy; compiler-generated copying of an index of iterators is not automatically valid. It is acceptable to explicitly disable copying and moving for this exercise.",
      "Keep cache/index invariants valid if allocation or string operations throw. Distributed caching and persistence are out of scope; the deliverable is working C++ methods.",
    ],
  },
  "leased-task-queue": {
    description: "Design and implement a single-threaded, in-memory C++17 TaskQueue with enqueue(id,payload), claim(now,lease_duration), and acknowledge(id,token,now). Model abandoned worker leases and reject stale acknowledgments.",
    examples: [{ input: "enqueue(J,work); claim(0,10) gives token 1; claim(10,10) gives token 2; acknowledge(J,1,11)", output: "The expired lease is reclaimed; the stale acknowledgment fails; token 2 still owns J." }, { input: "acknowledge(J,2,12); claim(13,10)", output: "Acknowledgment succeeds; J is removed; no task is available." }],
    constraints: [
      "IDs are nonempty strings unique for the queue's entire lifetime, including completed tasks. Duplicate or empty IDs are rejected without changing state. Payloads are strings copied into the queue.",
      "claim returns an optional record containing ID, payload, fresh token, and expiry. Choose the oldest enqueued eligible task; an unleased task or a task with expiry <= now is eligible.",
      "Every time-bearing call uses the same caller-supplied, nonnegative, nondecreasing integer millisecond clock. Lease duration must be positive. Reject invalid time or expiry overflow before mutating state.",
      "Acknowledgment succeeds only for the current token while now < expiry. Unknown IDs, stale tokens, and expired leases return false. A retry after a successful acknowledgment returns false.",
      "Tokens must not be reused across claims of the same task. A linear scan for eligible tasks is acceptable; explain scalability and optional indexing without being required to implement it.",
      "Workers are simulated callers; no networking, persistence, or threads are required. Lease expiry permits duplicate processing, so external side effects are not exactly once. Implement the state transitions in C++.",
    ],
  },
  "consistent-hash-ring": {
    description: "Implement a C++17 HashRouter with add_server(id,tokens), remove_server(id), and route(key_hash). Use caller-supplied unsigned 64-bit token positions on a consistent hash ring.",
    examples: [{ input: "A owns tokens [10,60]; B owns [30,90]; route(31); route(95)", output: "A for 31 (next token 60); A for 95 (wrap to 10)." }, { input: "Remove A; route(31); route(95)", output: "B for both keys (tokens 90 and 30 respectively)." }],
    constraints: [
      "route returns an optional server ID by value. Choose the first token position >= key_hash; if none exists, wrap to the smallest position. An empty ring returns nullopt.",
      "Server IDs are unique nonempty strings; each server has at least one token. Reject duplicate IDs, empty token lists, or repeated token positions within one server without changing the ring.",
      "Different servers may share a token position. At the same position, choose the lexicographically smallest server ID. Removing that server exposes the next server at the position.",
      "remove_server returns false for an unknown ID; otherwise remove all of its tokens. Removing and later adding the same ID is allowed.",
      "Unsigned positions include both zero and UINT64_MAX. Wrap using ordered lookup rather than arithmetic that overflows. Hash computation itself is outside this exercise.",
      "Target O(log T) routing for T tokens and O(K log T) updates for a server with K tokens. Discuss movement of key ranges and ownership invariants; implement the routing and membership operations in C++.",
    ],
  },
  "round-robin-scheduler": {
    description: "Implement a C++17 discrete-event round-robin CPU scheduler. Accept processes with unique IDs, arrival times, and CPU burst lengths, plus a time quantum. Return execution slices and completion times.",
    examples: [{ input: "P1 arrives at 0 with burst 5; P2 arrives at 1 with burst 3; quantum=2", output: "P1 [0,2), P2 [2,4), P1 [4,6), P2 [6,7), P1 [7,8); completion P1=8, P2=7." }, { input: "P1 arrives at 5 with burst 1; quantum=2", output: "CPU idle until 5; P1 [5,6), completion=6." }],
    constraints: [
      "Single CPU, no I/O blocking, no context-switch cost, and no real threads. Processes may be provided unsorted. Equal arrival times preserve original input order.",
      "Arrival times are nonnegative, burst lengths and quantum are positive. Use signed 64-bit times; reject duplicate IDs or invalid inputs before producing a schedule. Inputs guarantee the complete schedule fits int64.",
      "Each dispatch executes min(quantum, remaining_burst). Arrivals during a slice join the ready queue in arrival order; arrival alone does not preempt the running process.",
      "At a slice boundary, enqueue all arrivals up to and including that time before requeuing the unfinished current process. A completed process is never requeued.",
      "When ready is empty, jump to the next arrival rather than simulating each idle tick. Empty input returns empty output. Execution slices are half-open [start,end).",
      "Target O(n log n + S) time for n processes and S returned slices. Store per-process remaining work and completion time; implement the event loop rather than explaining scheduling in prose only.",
    ],
  },
  "page-replacement": {
    description: "Implement a C++17 PageCache simulator using the clock (second-chance) replacement policy. access(page_id) reports whether the access caused a page fault and optionally which page was evicted.",
    examples: [{ input: "capacity=2; access sequence [1,2,1,3]", output: "Faults on 1, 2, and 3; access to 1 is a hit. Loading 3 evicts 1; frames are [3,2], hand points at frame 1." }],
    constraints: [
      "Capacity must be positive and fixed. Page IDs are nonnegative integers. Initially all frames are empty and the hand points at index 0.",
      "A hit sets that page's reference bit to true and leaves the hand unchanged. A fault examines frames starting at the hand.",
      "When examining an occupied frame whose bit is true, clear its bit and advance. Replace the first empty frame or occupied frame whose bit is false. Set the new page's bit to true and advance the hand past it, wrapping modulo capacity.",
      "No dirty pages, disk I/O, pinning, or actual virtual memory. No eviction is reported when filling an empty frame. Maintain a cumulative page-fault count.",
      "Provide a frame snapshot for inspection. Keep a page-to-frame index consistent during eviction; duplicate copies of a resident page are not allowed.",
      "Expected O(1) resident lookup is the target; a single replacement may scan O(capacity) frames. Explain this cost accurately and implement the clock hand and reference-bit logic in C++.",
    ],
  },
  "arena-allocator": {
    description: "Implement a C++17 ArenaAllocator that simulates allocation within a fixed-size byte arena. allocate(bytes) returns an optional offset; deallocate(offset) returns success or failure. Split free blocks and coalesce adjacent free blocks.",
    examples: [{ input: "capacity=32; allocate(8); allocate(8); deallocate(0); deallocate(8); allocate(24)", output: "Offsets 0 and 8; both frees succeed; adjacent blocks coalesce; allocation of 24 returns offset 0." }, { input: "capacity=16; allocate(9); allocate(1)", output: "First request rounds up to 16 and returns 0; second returns nullopt." }],
    constraints: [
      "Capacity is a positive multiple of 8. Requests round up to the next multiple of 8; all returned offsets are aligned to 8. A zero-byte request returns nullopt.",
      "Use first fit in increasing address order. Split a larger free block when space remains; failed allocation must not change arena state. Reject arithmetic overflow while rounding or computing block ends.",
      "Only exact start offsets of currently allocated blocks may be freed. Interior offsets, out-of-range offsets, and double frees return false without changing state.",
      "Coalesce both adjacent free neighbors after a free. The blocks always form a nonoverlapping partition of [0,capacity); account for all bytes, including internal rounding waste.",
      "This is an offset-based simulator: storing actual user objects, returning raw pointers, overriding operator new, and OS memory mapping are out of scope. Metadata can live outside the arena.",
      "An O(B) search for B blocks is acceptable. Implement allocation, splitting, validation, and coalescing in C++; discuss fragmentation and metadata exception safety.",
    ],
  },
  "expression-lexer": {
    description: "Implement a C++17 Lexer for an ASCII expression language. Produce tokens for decimal integers, identifiers, +, -, *, /, (, ), and a final end-of-input token, retaining each token's lexeme and starting byte offset.",
    examples: [{ input: "sum_1 + 42*(x-3)", output: "Identifier(sum_1)@0, Plus@6, Integer(42)@8, Star@10, LeftParen@11, Identifier(x)@12, Minus@13, Integer(3)@14, RightParen@15, End@16." }, { input: "a @ b", output: "Lexical error at byte offset 2; @ is not a valid token." }],
    constraints: [
      "Identifiers match [A-Za-z_][A-Za-z0-9_]*; integer lexemes match [0-9]+. Use maximal munch. The minus sign is always a separate token, not part of an integer.",
      "Skip ASCII space, tab, carriage return, and newline while preserving byte offsets. No comments, keywords, string literals, floating-point numbers, or Unicode identifiers.",
      "Token lexemes own their strings so results do not dangle after the input is destroyed. Do not convert integer values; range checks belong to a later stage.",
      "The first unrecognized byte produces a lexical error with its offset rather than being silently skipped. Empty or whitespace-only input returns only End, positioned at input.size().",
      "At most 100,000 input bytes. Target O(n) scanning time plus output storage. For character classification, avoid undefined behavior from passing a negative char to cctype functions.",
      "Require a concrete token model and scanner loop in C++. Demonstrate boundaries such as abc123, 123abc (Integer then Identifier), and a trailing identifier.",
    ],
  },
  "expression-parser": {
    description: "Implement a C++17 parser that accepts an arithmetic expression string and constructs an owning abstract syntax tree. Support decimal integers, parentheses, binary +, -, *, /, and unary minus.",
    examples: [{ input: "1 + 2 * 3", output: "Add(Integer(1), Multiply(Integer(2), Integer(3)))" }, { input: "8 - 3 - 1", output: "Subtract(Subtract(Integer(8), Integer(3)), Integer(1))" }, { input: "-(4+5)", output: "Negate(Add(Integer(4), Integer(5)))" }],
    constraints: [
      "Multiplication and division have higher precedence than addition and subtraction; binary operators are left-associative. Unary minus binds more tightly than binary operators and may repeat, such as --2.",
      "Accept ASCII whitespace. Integer token values are nonnegative and fit int64; oversized literals are parse errors. Unary minus is a distinct AST node. Identifiers, unary plus, assignments, and functions are out of scope.",
      "Consume all input. Report an error with a byte offset for unexpected tokens, missing operands, unmatched parentheses, invalid bytes, or empty input. Do not silently parse only a prefix.",
      "AST nodes own their children, preferably through std::unique_ptr; no dangling source views or leaked nodes on a failed parse. Tokenization may be implemented inline or as a helper in the same code.",
      "At most 10,000 tokens and at most 256 nested parentheses or unary operators. Inputs beyond these bounds may be rejected. Aim for linear time; evaluation and constant folding are out of scope.",
      "Require the AST representation and concrete parsing methods in C++. Clarify precedence and associativity before supplying them proactively.",
    ],
  },
  "bytecode-vm": {
    description: "Implement a C++17 stack virtual machine with PUSH(value), ADD, SUB, MUL, DIV, DUP, JUMP(target), JUMP_IF_ZERO(target), and HALT instructions. Execution returns the top stack value on HALT or a structured runtime error.",
    examples: [{ input: "PUSH 7; PUSH 2; SUB; HALT", output: "5 (binary operations consume right operand first, then left)." }, { input: "PUSH 0; JUMP_IF_ZERO 4; PUSH 99; HALT; PUSH 7; HALT", output: "7; JUMP_IF_ZERO consumes the zero and jumps to instruction index 4." }, { input: "JUMP 0 with an instruction budget of 10", output: "Instruction-budget error after 10 executed instructions." }],
    constraints: [
      "Values are signed 64-bit integers. ADD, SUB, MUL, and DIV consume two operands in left op right order; DUP requires one and copies the top. Detect signed overflow without causing undefined behavior.",
      "Integer division truncates toward zero. Division by zero and INT64_MIN / -1 are runtime errors. Stack underflow includes HALT on an empty stack.",
      "Jumps use absolute, zero-based instruction indices; JUMP_IF_ZERO pops its condition regardless of whether the jump is taken. Validate the target when executing either jump, even if the condition is nonzero.",
      "Falling off the program is an error; HALT may leave additional values below the returned top. An empty program is an error. Unknown opcodes are errors.",
      "A positive caller-provided instruction budget bounds loops; HALT counts as an executed instruction. Reaching the budget without executing HALT is an error. Enforce a caller-provided positive maximum stack depth before pushing.",
      "Return errors including the faulting instruction index and reason; budget exhaustion reports the next instruction index. Each run starts with fresh stack and program counter. Implement the dispatch loop in C++; bytecode compilation and native code generation are out of scope.",
    ],
  },
  "order-book": {
    description: "Implement a single-instrument in-memory C++17 limit order book with submit and cancel operations and best bid/ask queries. Incoming orders match resting opposite-side orders at the resting price, using price-time priority, and produce trade records. Remaining quantity rests in the book.",
    examples: [{ input: "Submit sell A at 100 for 5; sell B at 100 for 3; buy C at 101 for 6.", output: "Trades: C/A, 5 at 100; C/B, 1 at 100. B rests with quantity 2; C is fully filled." }, { input: "Cancel B, then cancel B again.", output: "First cancellation succeeds; second reports not found." }],
    constraints: [
      "Single-threaded, single instrument, no persistence. Limit orders only; market orders, amendments, and auctions are out of scope.",
      "Prices and quantities are positive integer ticks/units stored in 64-bit integers; avoid floating point. Reject malformed requests without changing the book.",
      "Order IDs must be globally unique for this book's lifetime, including filled/cancelled orders. Duplicate submission is rejected. A monotonic arrival sequence breaks ties at a price level.",
      "Best price first, then FIFO within a price level. Buy crosses when buy price >= best ask; sell crosses when sell price <= best bid. Trades execute at the resting order price and may partially fill both sides.",
      "Cancellation affects only remaining quantity, removes empty price levels, and cannot invalidate other indexed orders. Best bid/ask returns an optional value when empty.",
      "Target O(log P + F) matching plus processed price-level removal overhead, for P price levels and F fills; cancellation lookup expected O(1), with O(log P) if a price level is removed. Explain pointer/iterator stability and ownership across book and ID index.",
      "Discuss invariants, deterministic replay, large-order complexity, stale indices, overflow, and exception safety as the candidate progresses. Manual review only.",
    ],
  },
  "bounded-queue": {
    description: "Implement a C++17 bounded multiple-producer/multiple-consumer queue with blocking push, blocking pop, and close. Use mutexes and condition variables; a lock-free algorithm is not required.",
    examples: [{ input: "Capacity 1; push A; another producer pushes B.", output: "B blocks until a consumer removes A or close is called." }, { input: "Queue has A; close(); pop(); pop().", output: "First pop yields A; second reports closed and empty. All future pushes fail." }],
    constraints: ["Capacity is positive and fixed; reject zero capacity.", "FIFO and linearizable operations. close is idempotent and wakes all blocked producers and consumers.", "After close, queued items may be drained; no new items are accepted. pop returns an optional item; push reports failure when closed.", "Handle spurious wakeups, predicate checks under the mutex, and notification when space/data becomes available.", "Assume T is nothrow move-constructible. State allocation-failure behavior explicitly; do not lose an item on a failed enqueue.", "Destructor requires the caller to close and join all users first; destruction concurrent with operations is out of scope. No busy-waiting or compilation claims."],
  },
  "replicated-kv": {
    description: "Design a three-node, crash-fault-tolerant key-value store supporting linearizable get and put under leader failure and network partitions. Describe a quorum-based consensus protocol and recovery, not merely asynchronous mirroring.",
    examples: [{ input: "A put is acknowledged; the leader crashes; a new leader is elected.", output: "The acknowledged value remains visible to subsequent successful reads." }, { input: "One node is isolated from the other two.", output: "The majority can make progress; the isolated node cannot acknowledge writes or serve unfenced linearizable reads." }],
    constraints: ["Crash/restart faults, not Byzantine faults. Stable disk survives restart. At most one unavailable node for progress; safety must hold under arbitrary partitions.", "Commands are replicated in an ordered durable log. Acknowledged writes must be committed to a majority and survive leader replacement.", "Specify terms, vote rules, election restrictions, log consistency, durable state, commit/apply rules, and stale-leader fencing. Reuse Raft if desired; correctly explain its safety mechanisms.", "Linearizable reads require a safe quorum/read-index or correctly justified lease mechanism, not just a read from whoever believes it is leader.", "Client retries use request IDs and a replicated deduplication result. Timeouts mean unknown outcome, not definite failure.", "Discuss snapshots, follower catch-up, membership-change safety, and crash points progressively. Do not promise availability for minority partitions or claim exactly-once network delivery."],
  },
  "distributed-jobs": {
    description: "Design a durable multi-worker job queue with at-least-once delivery, bounded leases, retry backoff, and dead-letter handling. Prevent stale workers from acknowledging jobs owned by a newer lease.",
    examples: [{ input: "Worker A leases job J and stalls; its lease expires; worker B leases J; A later acknowledges.", output: "A's stale acknowledgment is rejected using the lease token/generation; B retains the current lease." }],
    constraints: ["Queue metadata is stored in a transactional durable database. Enqueue and claim operations are atomic; claims return a unique lease generation/token.", "Workers may crash, run slowly, or lose responses. Lease extension and acknowledgment compare the current token. Use an authoritative server/database clock for lease expiry.", "Retries use capped exponential backoff and an attempt budget; exhausted jobs move to a dead-letter state. Specify crash recovery and visibility semantics.", "Delivery is at least once. External side effects may be duplicated unless the destination supports an idempotency key or a suitable transaction; do not promise exactly-once side effects merely with leases.", "Explain polling fairness, indexes, backpressure, lease renewal, poison jobs, and transactional outbox integration where relevant."],
  },
  "distributed-rate-limiter": {
    description: "Design a per-tenant token-bucket rate limiter used by multiple application servers, enforcing a shared budget with burst capacity and atomic decisions.",
    examples: [{ input: "Bucket capacity 10, refill 2 tokens/second, initially full; 11 simultaneous unit-cost requests.", output: "At most 10 requests are accepted; after one second, up to 2 more tokens are available." }],
    constraints: ["A tenant's bucket state lives on one authoritative shared store shard. Decisions and refills are atomic; application-server local buckets alone are insufficient.", "Use store-authoritative nondecreasing timestamps and cap refills at bucket capacity. State numeric precision and fractional refill behavior.", "Requests have positive cost; reject costs above capacity. Return allowed/denied and a meaningful retry-after duration.", "The shared store uses durable/strongly consistent operations for this exercise. During store unavailability, fail closed rather than silently oversubscribe.", "Handle duplicate request IDs idempotently within a bounded retry window, including lost responses. Explain the memory/correctness tradeoff of that window.", "Discuss hot tenants, idle-state expiry, sharding, config changes, and what consistency/availability guarantees change if the store becomes asynchronously replicated."],
  },
  "sharded-rebalance": {
    description: "Design an online migration of a key range from source shard A to destination B while preserving linearizable per-key reads/writes and surviving coordinator failure.",
    examples: [{ input: "A key is updated during snapshot transfer; later the routing map switches to B.", output: "The update is present at B before cutover, and stale clients cannot successfully write to A after ownership transfers." }],
    constraints: ["Each shard has durable storage and an ordered change log. A strongly consistent metadata service stores range ownership and monotonically increasing epochs.", "Copy a snapshot at a known log position, then replay subsequent mutations in order, including deletes. Apply replay idempotently.", "Only one shard may accept authoritative writes for a range at any time. Use epochs/fencing to reject stale ownership, including cached routes and a failed/restarted coordinator.", "A brief cutover pause is acceptable; permanent downtime or silent lost writes is not. Ensure destination catches up before the atomic ownership switch.", "Migration progress is durable and restartable. Explain failure before/after fencing, before/after metadata switch, and safe rollback versus roll-forward.", "Delay source cleanup until ownership and recovery rules make it safe. Cross-key transactions are out of scope; do not silently assume clocks establish ownership."],
  },
  "owned-buffer": {
    description: "Repair the owning Buffer class in C++17 using a raw int array. Implement the Rule of Five: destructor, deep copy constructor, deep copy assignment, noexcept move constructor, and noexcept move assignment. Copies own independent storage. Preserve the public constructor, size(), and subscript access. Do not replace the class with std::vector or a smart pointer for this exercise.",
    examples: [
      { input: "Buffer a(2); a[0] = 7; Buffer b = a; b[0] = 9;", output: "a[0] remains 7; b[0] is 9; each allocation is freed once." },
      { input: "Buffer a(2); a = a;", output: "a remains valid with unchanged size and contents." },
      { input: "Buffer b = std::move(a);", output: "b owns the transferred allocation; a.size() is 0; a can be destroyed or assigned to safely." },
    ],
    constraints: [
      "Use C++17, raw new[] / delete[], and no compiler or execution service; review is manual only.",
      "Size can be zero. Any acquired allocation must be released exactly once with delete[].",
      "Copies must deep-copy elements and be independent. Copy assignment must be safe for self-assignment and provide the strong exception guarantee if allocation fails.",
      "Moves must be noexcept and leave the source empty (size 0, data nullptr). Move assignment must handle self-move safely.",
      "Subscript indices are caller-guaranteed in range; bounds checking is not required. int elements cannot throw during copying.",
      "Review notes: the given destructor mismatches new[] with delete; copy operations alias ownership; assignment deletes before allocation, has self-assignment hazards, and lacks safe copy semantics; no move operations are defined. Reveal flaws through focused questions, not a complete unsolicited checklist.",
    ],
  },
  "erase-nodes": {
    description: "Repair erase_value in C++17 to remove and delete every node whose value matches the argument, returning the updated head. The function owns the removal of matching nodes but must preserve the remaining nodes and their order.",
    examples: [
      { input: "head = 2 -> 2 -> 3 -> 2; value = 2", output: "3; all three removed nodes are deleted exactly once." },
      { input: "head = nullptr; value = 2", output: "nullptr" },
      { input: "head = 2 -> 2; value = 2", output: "nullptr; both nodes are deleted." },
    ],
    constraints: [
      "The list is singly linked and acyclic. Each node was individually allocated with new Node and has no recursive destructor.",
      "Remove all matches, including head and consecutive matches. Preserve nonmatching node addresses and order.",
      "An empty list is valid. No external aliases to removed nodes need to remain usable.",
      "Use delete once per removed node, no new allocations, O(n) time, and O(1) extra space.",
      "Review is manual; do not claim compilation, execution, or sanitizer results.",
      "Review notes: the given function reads current->next after delete, sets previous to freed memory, never updates head on removal, and mishandles consecutive matches. Let the candidate discover issues through targeted questions.",
    ],
  },
  "two-sum": {
    description: "Given an array of integers and an integer target, return a boolean indicating whether two elements at different indices sum to the target. A pair may not exist; multiple pairs may exist. Do not return the pair or its indices.",
    examples: [
      { input: "elements = [2, 7, 11, 15], target = 9", output: "True" },
      { input: "elements = [3, 3], target = 6", output: "True" },
      { input: "elements = [3, 2, 4], target = 7", output: "True" },
      { input: "elements = [3], target = 6", output: "False" },
      { input: "elements = [1, 2], target = 9", output: "False" },
      { input: "elements = [], target = 0", output: "False" },
    ],
    constraints: [
      "0 ≤ len(elements) ≤ 10,000.",
      "Elements and target are integers between -1,000,000,000 and 1,000,000,000, inclusive.",
      "The array is not necessarily sorted. Duplicate and negative values are allowed.",
      "The two elements must come from different indices; a single element cannot be reused.",
      "Return True if at least one pair exists, otherwise False. Empty and single-element arrays return False.",
      "Do not mutate the input array. Aim for O(n) time; O(n) extra space is acceptable.",
    ],
  },
  "valid-parentheses": {
    description: "Given a string containing only (, ), [, ], { and }, return a boolean indicating whether every opening bracket is closed by the same type in the correct nesting order. The empty string is valid.",
    examples: [
      { input: 's = "()[]{}"', output: "True" },
      { input: 's = "([)]"', output: "False" },
      { input: 's = "{[]}"', output: "True" },
      { input: 's = ""', output: "True" },
    ],
    constraints: ["0 ≤ len(s) ≤ 10,000.", "The input contains only the six bracket characters.", "Both bracket type and nesting order must match.", "Return a boolean, not a corrected string.", "Aim for O(n) time; O(n) extra space is acceptable."],
  },
  "longest-substring": {
    description: "Given a string, return the length of its longest contiguous substring with no repeated characters. A subsequence does not count. Return 0 for an empty string.",
    examples: [
      { input: 's = "abcabcbb"', output: "3" },
      { input: 's = "bbbbb"', output: "1" },
      { input: 's = "pwwkew"', output: "3" },
      { input: 's = ""', output: "0" },
    ],
    constraints: ["0 ≤ len(s) ≤ 50,000.", "Assume ASCII input, including spaces and punctuation. Comparisons are case-sensitive.", "A substring must be contiguous.", "Return the length as an integer, not the substring itself.", "Aim for O(n) time; O(k) extra space for k distinct characters is acceptable."],
  },
};

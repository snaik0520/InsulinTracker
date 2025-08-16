// ...imports...
export function TransactionHistory() {
  // ...existing state and query code...
  // ...helpers...

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
          <History className="h-4 w-4 mr-2" />
          Transaction History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <History className="h-5 w-5" />
            Medication Transaction History
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-full max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-blue-600">Loading transactions...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No transactions recorded yet.</h3>
              <p className="text-sm">
                Add or dispense medications to see transaction history.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => {
                const { date, time } = formatTimestamp(transaction.timestamp);
                const Icon = getTransactionIcon(transaction.type);
                const nameOnly = transaction.medicationName.split(" - ")[0];
                const [generic, withParen] = nameOnly.split(" (");
                const medical = withParen?.replace(")", "") ?? "";
                return (
                  <div
                    key={transaction.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      {/* LEFT: icon + name + description */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-full ${getTransactionColor(transaction.type)}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {generic} {medical && `(${medical})`}
                          </h4>
                          <p className="text-sm text-gray-600 mt-2">
                            {getTransactionDescription(transaction)}
                          </p>
                          {/* NEW: Show comment if present */}
                          {transaction.comment && (
                            <div className="text-xs text-gray-500 mt-1">
                              <b>Comment:</b> {transaction.comment}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* RIGHT: Badge (title) and timestamp aligned to right */}
                      <div className="ml-4 flex flex-col items-end text-right">
                        <Badge
                          variant="outline"
                          className={`${getTransactionColor(transaction.type)} px-2 py-1`}
                        >
                          {getTransactionTitle(transaction.type)}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                          <Clock className="h-3 w-3" />
                          <span>
                            {date} at {time}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
